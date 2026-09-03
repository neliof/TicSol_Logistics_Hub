#!/bin/bash

# Setup script for TicSol Logistics Hub — Database initialization and migrations
#
# Prerequisites:
#   - PostgreSQL 12+ running
#   - PGHOST, PGUSER, PGPASSWORD (or .pgpass) configured
#   - psql available in PATH
#
# Usage:
#   chmod +x database/setup.sh
#   ./database/setup.sh

set -e

DB_NAME="ticsol_logistics_hub"
MIGRATIONS_DIR="."

echo "=== TicSol Logistics Hub Database Setup ==="

# Connect as superuser (postgres) to create DB and app_user
echo "[1/4] Creating database and app_user…"
psql -U postgres -h "${PGHOST:-localhost}" -v ON_ERROR_STOP=1 <<EOF
-- Create database if not exists
CREATE DATABASE $DB_NAME OWNER postgres;

-- Connect to the new database
\c $DB_NAME

-- Drop app_user if exists (for idempotency)
DROP USER IF EXISTS app_user;

-- Create app_user with strong password
CREATE USER app_user WITH ENCRYPTED PASSWORD '${APP_USER_PASSWORD:-changeme}';

-- Grant necessary privileges
GRANT CONNECT ON DATABASE $DB_NAME TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT USAGE ON SCHEMA logistics TO app_user;
GRANT CREATE ON SCHEMA logistics TO postgres; -- Allow migrations

-- RLS will be enabled per table in migrations
EOF

echo "[2/4] Applying migrations…"
# Apply migrations in order
for migration in 01 02 03 04 05 06 07; do
  if [ -f "$MIGRATIONS_DIR/${migration}_*.sql" ]; then
    echo "  Applying $migration…"
    psql -U postgres -d "$DB_NAME" -h "${PGHOST:-localhost}" -v ON_ERROR_STOP=1 -f "$MIGRATIONS_DIR/${migration}_*.sql" || true
  fi
done

# Apply security migration (08_app_user_rls.sql)
if [ -f "$MIGRATIONS_DIR/08_app_user_rls.sql" ]; then
  echo "[3/4] Applying app_user and RLS policies…"
  psql -U postgres -d "$DB_NAME" -h "${PGHOST:-localhost}" -v ON_ERROR_STOP=1 -f "$MIGRATIONS_DIR/08_app_user_rls.sql"
fi

echo "[4/4] Database setup complete."
echo ""
echo "Next steps:"
echo "  1. Copy server/.env.example to server/.env"
echo "  2. Update .env with:"
echo "     - DB_PASSWORD=${APP_USER_PASSWORD:-changeme}"
echo "     - JWT_SECRET (generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\")"
echo "  3. npm install && npm start"
