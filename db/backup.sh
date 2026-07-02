#!/usr/bin/env bash
# Back up the License Tracking System database to a timestamped file.
#
# Postgres (Neon): set DATABASE_URL, then run  ./db/backup.sh
#   -> creates db/backups/backup-YYYYMMDD-HHMMSS.sql  (restore with psql)
# SQLite (local):  if DATABASE_URL is not set, it copies server/data/license-tracker.db
#
# Usage:
#   DATABASE_URL="postgresql://…" ./db/backup.sh
#   ./db/backup.sh                 # local SQLite copy

set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/backups"
mkdir -p "$OUT"
STAMP="$(date +%Y%m%d-%H%M%S)"

if [ -n "${DATABASE_URL:-}" ]; then
  FILE="$OUT/backup-$STAMP.sql"
  echo "Backing up PostgreSQL → $FILE"
  pg_dump "$DATABASE_URL" > "$FILE"
  echo "Done. Restore with:  psql \"\$DATABASE_URL\" -f \"$FILE\""
else
  SRC="$DIR/../server/data/license-tracker.db"
  FILE="$OUT/license-tracker-$STAMP.db"
  if [ -f "$SRC" ]; then
    cp "$SRC" "$FILE"
    echo "Backed up SQLite → $FILE"
  else
    echo "No SQLite file at $SRC and DATABASE_URL not set — nothing to back up." >&2
    exit 1
  fi
fi
