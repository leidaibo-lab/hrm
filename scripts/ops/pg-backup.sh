#!/usr/bin/env bash
# agentic 备份演练：导出指定数据库到本地文件。
# 用法：PG_CONTAINER=cip-platform-postgres-1 scripts/ops/pg-backup.sh <db> [out.sql]
set -euo pipefail
DB="${1:?用法: pg-backup.sh <db> [out.sql]}"
OUT="${2:-backups/${DB}-$(date +%Y%m%d%H%M%S).sql}"
CONTAINER="${PG_CONTAINER:-cip-platform-postgres-1}"
PG_USER="${PG_USER:-cip}"
mkdir -p "$(dirname "$OUT")"
docker exec "$CONTAINER" pg_dump -U "$PG_USER" -d "$DB" > "$OUT"
echo "backup: $OUT ($(wc -c < "$OUT") bytes)"
