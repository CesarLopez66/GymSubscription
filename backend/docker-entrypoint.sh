#!/usr/bin/env bash
set -e

DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"

echo "Waiting for Postgres at ${DB_HOST}:${DB_PORT}..."
until nc -z "$DB_HOST" "$DB_PORT"; do
  sleep 1
done
echo "Postgres is up."

# Migrations need table-owner privileges (CREATE TABLE, CREATE POLICY, ALTER
# TABLE ... FORCE ROW LEVEL SECURITY). The app's own DATABASE_URL is
# intentionally a restricted, non-superuser role so RLS actually applies to
# it — so migrations run against MIGRATION_DATABASE_URL instead, falling
# back to DATABASE_URL only if that isn't set (e.g. a single-role dev setup).
echo "Running migrations..."
DATABASE_URL="${MIGRATION_DATABASE_URL:-$DATABASE_URL}" alembic upgrade head

exec "$@"
