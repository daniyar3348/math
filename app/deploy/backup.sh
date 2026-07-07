#!/usr/bin/env bash
# Безопасный бэкап SQLite (через .backup — консистентно даже под нагрузкой).
# Запуск вручную:  ./deploy/backup.sh
# Кроном (каждую ночь в 03:30):
#   30 3 * * * cd /opt/esep/app && ./deploy/backup.sh >> backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p backups

docker compose -f docker-compose.prod.yml exec -T app \
  sqlite3 /app/data/esep.db ".backup '/app/data/.backup-tmp.db'"
mv data/.backup-tmp.db "backups/esep-$STAMP.db"
gzip "backups/esep-$STAMP.db"

# Держим последние 14 бэкапов
ls -t backups/esep-*.db.gz 2>/dev/null | tail -n +15 | xargs -r rm --

echo "OK: backups/esep-$STAMP.db.gz"
