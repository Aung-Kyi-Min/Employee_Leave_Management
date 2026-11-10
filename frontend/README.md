# Employee Leave Management frontend

Run `npm install` then `npm run dev` in this directory. Start the backend on port 8080;
Vite proxies `/api` to it. Sign in with an active database account.

The Leave page loads active leave types, the signed-in employee's requests, and yearly
balances from the backend. Selecting a start date loads that year's balances. It supports
submission, status filtering, cancellation of pending requests, and reviewer comments.
Balances must be allocated in the database before an employee can request leave.
For local demo accounts and balances, use `backend/sql/seed_postman_leave_demo.sql`
after the migrations and employee demo seed have run.

Managers see pending requests assigned to them and can approve or reject them with optional
comments. Decisions are persisted by the backend. Refresh retrieves the latest queue.

Run `npm run build` for a production bundle and `npm run lint` for static checks.
In production, route `/api` to the backend through your hosting proxy.
