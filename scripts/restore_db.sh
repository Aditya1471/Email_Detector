#!/bin/bash
set -e

# PhishGuard PostgreSQL Staging Restore Verification Script
# Usage: ./restore_db.sh <backup_file_path> [target_container] [db_user] [db_name]
# Security: Passwords must NEVER be passed as CLI arguments.
#           Uses disposable container credentials or environment PGPASSWORD.

BACKUP_FILE=$1
CONTAINER=${2:-pg-test-restore}
USER=${3:-postgres}
DB=${4:-phishguard_restore}

if [ -z "$BACKUP_FILE" ]; then
  echo "❌ Error: Please specify backup file path."
  echo "Usage: ./restore_db.sh <backup_file_path> [target_container] [db_user] [db_name]"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "=== Starting restore verification process ==="
echo "Backup File: $BACKUP_FILE"
echo "Target Container: $CONTAINER"
echo "Target DB: $DB"

# Check if target container is running, start disposable postgres if not present
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "Starting a disposable test container '$CONTAINER'..."
  TEST_PASS="${RESTORE_TEST_PASSWORD:-disposable_verify_secret}"
  docker run --name "$CONTAINER" -e POSTGRES_PASSWORD="$TEST_PASS" -d postgres:15-alpine
  sleep 5
fi

# Create target database if needed
echo "Creating restore target database..."
docker exec -i "$CONTAINER" psql -U "$USER" -c "CREATE DATABASE $DB;" || true

# Copy and restore
echo "Restoring data from archive..."
docker cp "$BACKUP_FILE" "${CONTAINER}:/tmp/restore.dump"
docker exec -i "$CONTAINER" pg_restore -U "$USER" -d "$DB" /tmp/restore.dump

# Validate Alembic schema revision
echo "Verifying restored alembic schema version..."
docker exec -i "$CONTAINER" psql -U "$USER" -d "$DB" -c "SELECT * FROM alembic_version;"

echo "✅ Restore verification completed successfully."
