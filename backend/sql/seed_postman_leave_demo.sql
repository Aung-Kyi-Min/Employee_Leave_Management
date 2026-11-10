-- Development/Postman demo data for leave APIs.
-- Run after Flyway migrations and seed_demo_employees.sql.
-- Adds separate Postman Demo leave types and balances without overwriting existing
-- leave data, plus realistic approved/pending/rejected/cancelled request examples.
-- Safe to rerun: existing sample requests are not duplicated and approved days
-- are added to used_days only when the approved request is first inserted.

BEGIN;

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM employees
        WHERE email IN ('zay.demo@example.com','su.demo@example.com','min.demo@example.com')
          AND is_active = TRUE) <> 3 THEN
        RAISE EXCEPTION 'Run seed_demo_employees.sql first; Zay, Su, and Min must be active';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM employees e
        LEFT JOIN employees m ON m.employee_id = e.manager_id AND m.is_active = TRUE
        LEFT JOIN employee_roles er ON er.employee_id = m.employee_id
        LEFT JOIN roles r ON r.role_id = er.role_id AND r.role_name = 'MANAGER'
        WHERE e.email IN ('zay.demo@example.com','su.demo@example.com','min.demo@example.com')
          AND (m.employee_id IS NULL OR r.role_id IS NULL)
    ) THEN
        RAISE EXCEPTION 'Each demo employee must have an active manager with the MANAGER role';
    END IF;
END $$;

INSERT INTO leave_types (leave_name, description, requires_approval, is_paid, is_active)
VALUES
    ('Postman Demo - Annual Leave', 'Annual vacation entitlement; weekdays only', TRUE, TRUE, TRUE),
    ('Postman Demo - Sick Leave', 'Paid sick leave for illness or medical appointments', TRUE, TRUE, TRUE),
    ('Postman Demo - Personal Leave', 'Personal or family responsibility leave', TRUE, TRUE, TRUE)
ON CONFLICT (leave_name) DO NOTHING;

-- Illustrative 2026 balances for all active employee demo accounts.
INSERT INTO leave_balances
    (employee_id, leave_type_id, leave_year, entitled_days, used_days, carried_forward_days)
SELECT e.employee_id, t.leave_type_id, 2026,
       CASE t.leave_name
           WHEN 'Postman Demo - Annual Leave' THEN 18
           WHEN 'Postman Demo - Sick Leave' THEN 14
           ELSE 5
       END,
       0,
       CASE WHEN t.leave_name = 'Postman Demo - Annual Leave' THEN 2 ELSE 0 END
FROM employees e
CROSS JOIN leave_types t
WHERE e.email IN ('zay.demo@example.com','su.demo@example.com','min.demo@example.com')
  AND e.is_active = TRUE
  AND t.leave_name IN (
      'Postman Demo - Annual Leave',
      'Postman Demo - Sick Leave',
      'Postman Demo - Personal Leave'
  )
ON CONFLICT (employee_id, leave_type_id, leave_year) DO NOTHING;

-- Sample history and upcoming requests. Approved records update leave_balances;
-- pending records receive a PENDING approval assigned to the employee's manager.
WITH samples(employee_email, leave_name, start_date, end_date, total_days, status, reason, comments) AS (
    VALUES
        ('zay.demo@example.com', 'Postman Demo - Annual Leave', DATE '2026-10-12', DATE '2026-10-14', 3, 'APPROVED',  'Postman demo: Zay approved annual leave',  'Approved; family vacation'),
        ('zay.demo@example.com', 'Postman Demo - Annual Leave', DATE '2026-12-16', DATE '2026-12-17', 2, 'PENDING',   'Postman demo: Zay pending annual leave',   NULL),
        ('zay.demo@example.com', 'Postman Demo - Sick Leave',   DATE '2026-12-18', DATE '2026-12-18', 1, 'REJECTED',  'Postman demo: Zay rejected sick leave',    'Please attach the required medical note'),
        ('zay.demo@example.com', 'Postman Demo - Personal Leave',DATE '2026-12-21', DATE '2026-12-21', 1, 'CANCELLED', 'Postman demo: Zay cancelled personal leave','Cancelled by requester'),
        ('su.demo@example.com',  'Postman Demo - Annual Leave', DATE '2026-12-08', DATE '2026-12-09', 2, 'PENDING',   'Postman demo: Su pending annual leave',    NULL),
        ('min.demo@example.com', 'Postman Demo - Sick Leave',   DATE '2026-10-05', DATE '2026-10-06', 2, 'APPROVED',  'Postman demo: Min approved sick leave',    'Approved for recovery'),
        ('min.demo@example.com', 'Postman Demo - Personal Leave',DATE '2026-12-10', DATE '2026-12-11', 2, 'PENDING',  'Postman demo: Min pending personal leave', NULL)
), inserted AS (
    INSERT INTO leave_requests
        (employee_id, leave_type_id, start_date, end_date, total_days, reason, status)
    SELECT e.employee_id, t.leave_type_id, s.start_date, s.end_date,
           s.total_days, s.reason, s.status
    FROM samples s
    JOIN employees e ON e.email = s.employee_email AND e.is_active = TRUE
    JOIN leave_types t ON t.leave_name = s.leave_name AND t.is_active = TRUE
    WHERE NOT EXISTS (
        SELECT 1 FROM leave_requests existing
        WHERE existing.employee_id = e.employee_id
          AND existing.leave_type_id = t.leave_type_id
          AND existing.reason = s.reason
    )
    RETURNING request_id, employee_id, leave_type_id, start_date, total_days, status, reason
), approved_balance AS (
    UPDATE leave_balances b
    SET used_days = b.used_days + x.approved_days
    FROM (
        SELECT employee_id, leave_type_id,
               EXTRACT(YEAR FROM start_date)::INTEGER AS leave_year,
               SUM(total_days) AS approved_days
        FROM inserted
        WHERE status = 'APPROVED'
        GROUP BY employee_id, leave_type_id, EXTRACT(YEAR FROM start_date)
    ) x
    WHERE b.employee_id = x.employee_id
      AND b.leave_type_id = x.leave_type_id
      AND b.leave_year = x.leave_year
    RETURNING b.balance_id
), approval_rows AS (
    INSERT INTO approvals
        (request_id, approver_id, approval_level, decision, comments, decided_at)
    SELECT i.request_id, e.manager_id, 1,
           CASE WHEN i.status = 'CANCELLED' THEN 'REJECTED' ELSE i.status END,
           s.comments,
           CASE WHEN i.status = 'PENDING' THEN NULL ELSE CURRENT_TIMESTAMP END
    FROM inserted i
    JOIN employees e ON e.employee_id = i.employee_id
    JOIN samples s ON s.reason = i.reason
    ON CONFLICT (request_id, approval_level) DO NOTHING
    RETURNING approval_id
)
SELECT (SELECT COUNT(*) FROM inserted) AS requests_added,
       (SELECT COUNT(*) FROM approved_balance) AS balances_updated,
       (SELECT COUNT(*) FROM approval_rows) AS approvals_added;

COMMIT;

-- Verify request IDs and the assigned approver emails for Postman.
SELECT lr.request_id, e.email AS employee, m.email AS manager,
       t.leave_name, lr.start_date, lr.end_date, lr.total_days,
       lr.status, a.decision AS approval_decision, lr.reason
FROM leave_requests lr
JOIN employees e ON e.employee_id = lr.employee_id
JOIN leave_types t ON t.leave_type_id = lr.leave_type_id
LEFT JOIN employees m ON m.employee_id = e.manager_id
LEFT JOIN approvals a ON a.request_id = lr.request_id AND a.approval_level = 1
WHERE lr.reason LIKE 'Postman demo:%'
ORDER BY lr.start_date, e.email;
