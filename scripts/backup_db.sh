#!/bin/bash
set -e

# PhishGuard PostgreSQL Staging Backup Script
# Usage: ./backup_db.sh [container_name] [db_user] [db_name] [output_dir]
# Security: Passwords must NEVER be passed as CLI arguments.
#           Set PGPASSWORD in environment before calling, or rely on internal Docker container credentials.

CONTAINER=${1:-phishguard-db-staging}
USER=${2:-phishguard}
DB=${3:-phishguard}
OUT_DIR=${4:-./backups}

mkdir -p "$OUT_DIR"
TIMESTAMP=$(date +%Y%m%d%H%M%S)
OUT_FILE="${OUT_DIR}/phishguard_backup_${TIMESTAMP}.dump"

echo "=== Starting database backup ==="
echo "Target Container: $CONTAINER"
echo "Database: $DB"
echo "Output Path: $OUT_FILE"

# Execute pg_dump with custom format inside container without echoing credentials
if [ -n "$PGPASSWORD" ]; then
  docker exec -t -e PGPASSWORD="$PGPASSWORD" "$CONTAINER" pg_dump -U "$USER" -d "$DB" --format=custom > "$OUT_FILE"
else
  docker exec -t "$CONTAINER" pg_dump -U "$USER" -d "$DB" --format=custom > "$OUT_FILE"
fi

if [ ${PIPESTATUS[0]} -eq 0 ]; then
  echo "✅ Backup completed successfully."
  echo "Archive File: $OUT_FILE"
else
  echo "❌ Backup failed."
  exit 1
fi
