-- Runs once, automatically, on the Postgres container's first startup
-- (mounted into /docker-entrypoint-initdb.d/).
--
-- The role in DATABASE_URL (POSTGRES_USER, e.g. "subgym") is the cluster's
-- bootstrap superuser. Superusers ALWAYS bypass Row-Level Security, no
-- matter how many `FORCE ROW LEVEL SECURITY` policies exist — so the
-- running application must never connect as that role, or every RLS policy
-- in the RLS migration is silent dead weight.
--
-- This creates a second, unprivileged role for the app's *runtime*
-- connection. Migrations still run as the superuser/table-owner (CREATE
-- TABLE, CREATE POLICY, etc. require ownership); only the live app uses
-- this restricted role, so RLS actually applies to it.
--
-- ALTER DEFAULT PRIVILEGES here means tables created *later* by migrations
-- automatically grant this role DML rights — no separate grant step needed
-- after `alembic upgrade head` runs.

CREATE ROLE subgym_app LOGIN PASSWORD 'subgym_app';

GRANT CONNECT ON DATABASE subgym TO subgym_app;
GRANT USAGE ON SCHEMA public TO subgym_app;

ALTER DEFAULT PRIVILEGES FOR ROLE subgym IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO subgym_app;

ALTER DEFAULT PRIVILEGES FOR ROLE subgym IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO subgym_app;
