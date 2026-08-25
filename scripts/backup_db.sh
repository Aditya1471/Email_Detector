#!/bin/bash
set -e

# PhishGuard PostgreSQL Staging Backup Script
# Usage: ./backup_db.sh <container_name> <db_user> <db_name> <output_path>

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
echo "Output: $OUT_FILE"

# Execute pg_dump custom format inside container
docker exec -t "$CONTAINER" pg_dump -U "$USER" -d "$DB" --format=custom > "$OUT_FILE"

# Check exit status
if [ ${PIPESTATUS[0]} -eq 0 ]; then
  echo "✅ Backup completed successfully."
  echo "Size: $(du -sh "$OUT_FILE" | cut -f1)"
else
  echo "❌ Backup failed."
  exit 1
fi
