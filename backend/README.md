# Employee and authentication backend

Java 21, Spring Boot 4.1.2, JDBC, PostgreSQL and Flyway.

## Run locally

Create the PostgreSQL database and database user with schema creation permissions first.
For persistent local configuration, edit `backend/application-local.properties` and replace
`REPLACE_WITH_YOUR_POSTGRES_PASSWORD` with the actual PostgreSQL password for `leave_app`.
This file is ignored by Git and loaded from either the repository root or the backend directory.
On another checkout, copy `application-local.properties.example` to `application-local.properties` first.
Do not commit the private file. Java properties passwords use literal characters except backslashes,
which must be doubled (`\\`). Remove surrounding quotation marks when pasting a password.

Alternatively, without a local configuration file, set these environment variables in your shell or IDE run configuration:

```text
DB_URL=jdbc:postgresql://localhost:5432/leave_management_db
DB_USERNAME=leave_app
DB_PASSWORD=<your database password>
BOOTSTRAP_ADMIN_EMAIL=<your admin email>
BOOTSTRAP_ADMIN_PASSWORD=<a unique password of at least 12 characters>
```

From `backend/`, run `./mvnw spring-boot:run` (Windows: `mvnw.cmd spring-boot:run`).
Flyway applies V1 and V2 automatically. V1 is unchanged.
Bootstrap creates `ADMIN-001` and an Administration department only when the employee table is empty.
Remove the bootstrap variables after the first successful start. There is no public registration endpoint.
For an existing populated database, provision an ADMIN role assignment and BCrypt password through your database administrator.
V2 normalizes existing emails; existing case-insensitive duplicates must be resolved before migration.

The API listens on `http://localhost:8080`. CORS permits `http://localhost:5173` by default;
set `CORS_ALLOWED_ORIGINS` to a comma-separated list for other frontend origins.
Use HTTPS when deployed. Login throttling should be configured at the deployment gateway before public exposure.

## Frontend API contract

The authoritative contract is [OpenAPI](../docs/api/openapi.json), importable into Postman.
All request and response bodies use JSON. Authenticated calls require `Authorization: Bearer <accessToken>`.
Tokens are opaque random values, expire after eight hours, and only SHA-256 token hashes are stored.
Passwords use BCrypt; new passwords require 12–72 characters and at most 72 UTF-8 bytes.
Credentials and tokens have redacted string representations to avoid Spring debug logs exposing them.

| Method | Path | Access / behavior |
| --- | --- | --- |
| GET | `/api/health` | Public health check |
| POST | `/api/auth/login` | Public; `{ "email": "...", "password": "..." }` |
| GET | `/api/auth/me` | Current employee profile and roles |
| POST | `/api/auth/logout` | Revoke current token; 204 |
| PUT | `/api/auth/password` | `currentPassword`, `newPassword`; revoke all own tokens; 204 |
| GET | `/api/employees?page=0&size=20` | ADMIN; ordered array, page starts at 0; max size 100 |
| GET | `/api/employees/{id}` | ADMIN; employee profile |
| POST | `/api/employees` | ADMIN; create; 201 with Location header |
| PUT | `/api/employees/{id}` | ADMIN; full profile replacement; revoke target's tokens |
| DELETE | `/api/employees/{id}` | ADMIN; deactivate and revoke tokens; 204 |
| GET | `/api/departments` | ADMIN; existing department IDs and names |
| GET | `/api/leave-types` | Authenticated; active leave types |
| GET | `/api/leave-balances?year=2026` | Authenticated; own leave balances (current year by default) |
| POST | `/api/leave-requests` | Authenticated; submit a request for the signed-in employee; 201 |
| GET | `/api/leave-requests` | Authenticated; own requests |
| GET | `/api/leave-requests/assigned` | MANAGER; pending requests assigned to the signed-in manager |
| POST | `/api/leave-requests/{id}/decision` | Assigned MANAGER; `{ "decision": "APPROVED" | "REJECTED", "comments": "..." }` |
| POST | `/api/leave-requests/{id}/cancel` | Authenticated; cancel own pending request; 204 |

Login returns `accessToken`, `tokenType`, `expiresAt`, and `employee`.
Keep tokens in frontend memory and clear them on logout or 401; do not put them in URLs.
Employee and manager roles can access their own profile and password endpoints;
employee administration requires ADMIN. Permissions are read from the database on each request.
The last active ADMIN cannot be deactivated or lose ADMIN. Managers must be active with MANAGER role;
self-management and circular reporting chains are rejected.

Example employee creation body (use an existing department ID):

```json
{
  "employeeNumber": "EMP-001",
  "fullName": "Aung Kyi Min",
  "email": "aung@example.com",
  "password": "choose-a-unique-password",
  "departmentId": 1,
  "managerId": null,
  "jobTitle": "Developer",
  "hireDate": "2026-11-08",
  "roles": ["EMPLOYEE"]
}
```

PUT uses the same profile fields, omits `password`, and requires `active`.
Allowed roles: `ADMIN`, `MANAGER`, `EMPLOYEE`. Email is stored trimmed and lowercase.
Responses never contain password hashes. DELETE retains employee IDs and leave history;
inactive employees remain visible to admins and can be reactivated by PUT.
Passwords can only be changed with the current password in this phase.

Errors use `{ "status": 400, "message": "...", "errors": ["field: reason"] }`;
`errors` appears on validation failures. Statuses: 400 invalid input, 401 authentication failure,
403 insufficient role, 404 employee missing, 409 duplicate email/number or last-admin conflict.

### Leave request rules

Submit with `{ "leaveTypeId": 1, "startDate": "2026-12-01", "endDate": "2026-12-03", "reason": "..." }`.
The server derives the employee from the bearer token and calculates weekdays (Monday–Friday), excluding no
public holidays. Requests must include at least one weekday, stay within one calendar year, start today or
later, have no date overlap with the employee's pending or approved requests, and fit the available balance.
The available balance is entitled plus carried-forward days minus used and pending days. A yearly balance must already
exist for the employee and leave type. Pending requests reserve balance when checked, preventing multiple
pending requests from oversubscribing it. Requests needing approval are assigned to the employee's active
manager with the MANAGER role. Approval deducts used days; rejection and cancellation do not. Leave types
with `requires_approval=false` are auto-approved and deducted on submission. Only pending requests can be
cancelled; an approved request needs an administrator to correct the balance through the normal data process.
Submission, manager decisions and cancellation are written to `audit_logs`.

## Tests

Run `./mvnw test` from `backend/`. Tests start a real HTTP server and apply V1/V2 to isolated H2
in PostgreSQL compatibility mode. They exercise authentication, CRUD, role restrictions,
validation, duplicate conflicts, deactivation, logout, token expiry, password hashing/change,
last-admin protection and reporting-cycle validation. These tests need no development database.
H2 tests do not establish PostgreSQL runtime compatibility; run against PostgreSQL before deployment.

## Demo database records

After the application has applied migrations, open pgAdmin's Query Tool on
`leave_management_db` (local PostgreSQL port 5433 for this setup), open
[`sql/seed_demo_employees.sql`](sql/seed_demo_employees.sql), and execute the whole script.
The script is development-only and is not an automatic Flyway migration.
It inserts three departments, two managers, three active employees and one inactive employee.
It can be rerun without duplicating accounts or overwriting existing profiles, passwords or roles.

New demo accounts use password `DemoPassword123!` (stored as BCrypt hashes):

| Email | Role | Active |
| --- | --- | --- |
| aung.demo@example.com | MANAGER | Yes |
| hla.demo@example.com | MANAGER | Yes |
| zay.demo@example.com | EMPLOYEE | Yes |
| su.demo@example.com | EMPLOYEE | Yes |
| min.demo@example.com | EMPLOYEE | Yes |
| ei.demo@example.com | EMPLOYEE | No |

Log in with the existing administrator to call `GET /api/employees?page=0&size=100`
and `GET /api/departments`. Employee details use the `id` from that list:
`GET /api/employees/{id}`. Demo managers and employees can log in and call
`GET /api/auth/me`; listing all employees remains ADMIN-only. The inactive account returns 401.
All these endpoints query PostgreSQL through JDBC; no mock records are hardcoded in the backend.
Frontend display requires the frontend to call these endpoints separately.
