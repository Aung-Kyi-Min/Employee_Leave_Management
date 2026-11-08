INSERT INTO roles (role_name, description) VALUES
('ADMIN', 'Employee administration'), ('MANAGER', 'Leave approver'), ('EMPLOYEE', 'Employee self service');
UPDATE employees SET email=LOWER(TRIM(email));
ALTER TABLE employees ADD CONSTRAINT ck_employees_email_normalized CHECK (email=LOWER(TRIM(email)));
CREATE TABLE auth_tokens (
    token_hash VARCHAR(64) PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_auth_tokens_employee ON auth_tokens(employee_id);
