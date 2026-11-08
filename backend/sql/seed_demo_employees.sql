-- Development only; run after Flyway V1 and V2 on leave_management_db.
-- Password for NEW demo accounts: DemoPassword123!
-- Reruns preserve existing profiles, passwords and role assignments.
BEGIN;
INSERT INTO departments(department_name,description) VALUES
 ('Engineering','Software development'), ('Human Resources','People operations'), ('Finance','Accounting')
ON CONFLICT (department_name) DO NOTHING;

WITH inserted AS (
 INSERT INTO employees(employee_number,full_name,email,password_hash,department_id,manager_id,job_title,hire_date,is_active)
 SELECT 'DEMO-MGR-001','Aung Demo','aung.demo@example.com','$2a$12$lXDYhhqs7OkX7PDlbKeNNup9lWL0o/ch3mfLtwZSJNASkoH6vyZfK',department_id,NULL,'Engineering Manager',DATE '2026-01-15',TRUE
 FROM departments WHERE department_name='Engineering'
 ON CONFLICT DO NOTHING RETURNING employee_id
)
INSERT INTO employee_roles(employee_id,role_id)
SELECT inserted.employee_id,roles.role_id FROM inserted CROSS JOIN roles
WHERE roles.role_name='MANAGER';

WITH inserted AS (
 INSERT INTO employees(employee_number,full_name,email,password_hash,department_id,manager_id,job_title,hire_date,is_active)
 SELECT 'DEMO-MGR-002','Hla Demo','hla.demo@example.com','$2a$12$lXDYhhqs7OkX7PDlbKeNNup9lWL0o/ch3mfLtwZSJNASkoH6vyZfK',department_id,NULL,'HR Manager',DATE '2026-01-15',TRUE
 FROM departments WHERE department_name='Human Resources'
 ON CONFLICT DO NOTHING RETURNING employee_id
)
INSERT INTO employee_roles(employee_id,role_id)
SELECT inserted.employee_id,roles.role_id FROM inserted CROSS JOIN roles
WHERE roles.role_name='MANAGER';

WITH inserted AS (
 INSERT INTO employees(employee_number,full_name,email,password_hash,department_id,manager_id,job_title,hire_date,is_active)
 SELECT 'DEMO-EMP-001','Zay Demo','zay.demo@example.com','$2a$12$lXDYhhqs7OkX7PDlbKeNNup9lWL0o/ch3mfLtwZSJNASkoH6vyZfK',department_id,(SELECT employee_id FROM employees WHERE employee_number='DEMO-MGR-001'),'Software Engineer',DATE '2026-01-15',TRUE
 FROM departments WHERE department_name='Engineering'
 ON CONFLICT DO NOTHING RETURNING employee_id
)
INSERT INTO employee_roles(employee_id,role_id)
SELECT inserted.employee_id,roles.role_id FROM inserted CROSS JOIN roles
WHERE roles.role_name='EMPLOYEE';

WITH inserted AS (
 INSERT INTO employees(employee_number,full_name,email,password_hash,department_id,manager_id,job_title,hire_date,is_active)
 SELECT 'DEMO-EMP-002','Su Demo','su.demo@example.com','$2a$12$lXDYhhqs7OkX7PDlbKeNNup9lWL0o/ch3mfLtwZSJNASkoH6vyZfK',department_id,(SELECT employee_id FROM employees WHERE employee_number='DEMO-MGR-001'),'Product Designer',DATE '2026-01-15',TRUE
 FROM departments WHERE department_name='Engineering'
 ON CONFLICT DO NOTHING RETURNING employee_id
)
INSERT INTO employee_roles(employee_id,role_id)
SELECT inserted.employee_id,roles.role_id FROM inserted CROSS JOIN roles
WHERE roles.role_name='EMPLOYEE';

WITH inserted AS (
 INSERT INTO employees(employee_number,full_name,email,password_hash,department_id,manager_id,job_title,hire_date,is_active)
 SELECT 'DEMO-EMP-003','Min Demo','min.demo@example.com','$2a$12$lXDYhhqs7OkX7PDlbKeNNup9lWL0o/ch3mfLtwZSJNASkoH6vyZfK',department_id,(SELECT employee_id FROM employees WHERE employee_number='DEMO-MGR-002'),'Accountant',DATE '2026-01-15',TRUE
 FROM departments WHERE department_name='Finance'
 ON CONFLICT DO NOTHING RETURNING employee_id
)
INSERT INTO employee_roles(employee_id,role_id)
SELECT inserted.employee_id,roles.role_id FROM inserted CROSS JOIN roles
WHERE roles.role_name='EMPLOYEE';

WITH inserted AS (
 INSERT INTO employees(employee_number,full_name,email,password_hash,department_id,manager_id,job_title,hire_date,is_active)
 SELECT 'DEMO-EMP-004','Ei Demo','ei.demo@example.com','$2a$12$lXDYhhqs7OkX7PDlbKeNNup9lWL0o/ch3mfLtwZSJNASkoH6vyZfK',department_id,(SELECT employee_id FROM employees WHERE employee_number='DEMO-MGR-002'),'HR Assistant',DATE '2026-01-15',FALSE
 FROM departments WHERE department_name='Human Resources'
 ON CONFLICT DO NOTHING RETURNING employee_id
)
INSERT INTO employee_roles(employee_id,role_id)
SELECT inserted.employee_id,roles.role_id FROM inserted CROSS JOIN roles
WHERE roles.role_name='EMPLOYEE';

COMMIT;

SELECT e.employee_id,e.employee_number,e.email,d.department_name,m.full_name AS manager,e.is_active
FROM employees e JOIN departments d ON d.department_id=e.department_id
LEFT JOIN employees m ON m.employee_id=e.manager_id
WHERE e.employee_number LIKE 'DEMO-%' ORDER BY e.employee_id;
