# Local Docker demonstration

Copy `.env.example` to `.env`, replace the placeholder password, then run:

```bash
docker compose up --build -d
docker compose ps
curl -i http://localhost:3000/api/health
```

Compose uses a separate PostgreSQL database volume, not the database used by
`backend/application-local.properties`. Flyway creates the schema but does not
create demo employees or leave balances.

For fictional demonstration data only, run these from the repository root after
the backend has successfully applied its migrations:

```bash
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backend/sql/seed_demo_employees.sql
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backend/sql/seed_postman_leave_demo.sql
```

These existing seed scripts preserve existing accounts and avoid duplicating
sample data. Newly seeded active accounts use `DemoPassword123!`:

- Employee: `zay.demo@example.com`
- Manager: `aung.demo@example.com`

Open http://localhost:3000 and sign in. These demo accounts have no ADMIN role;
employee administration requires a separately provisioned administrator.
Do not use demo credentials or seed scripts for a public deployment.

Compose allows browser origins `http://localhost:3000` and
`http://127.0.0.1:3000`. If the frontend address changes, update
`CORS_ALLOWED_ORIGINS` in Compose and recreate the backend with
`docker compose up -d backend`. Spring checks the browser Origin header on
proxied POST requests too; allowing only the Vite development port 5173 causes
login to fail with `403 Invalid CORS request`.

`docker compose down` preserves the database volume. `docker compose down -v`
deletes it, including the seeded accounts and all other database records.
