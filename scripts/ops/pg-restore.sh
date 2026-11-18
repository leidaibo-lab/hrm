#!/usr/bin/env bash
# agentic 恢复演练：把备份导入一个已存在的目标库（禁止覆盖业务库）。
# 用法：PG_CONTAINER=cip-platform-postgres-1 scripts/ops/pg-restore.sh <db> <backup.sql>
set -euo pipefail
DB="${1:?用法: pg-restore.sh <db> <backup.sql>}"
FILE="${2:?缺少备份文件}"
CONTAINER="${PG_CONTAINER:-cip-platform-postgres-1}"
PG_USER="${PG_USER:-cip}"
if [ "$DB" = "cip" ]; then
  echo "拒绝恢复到业务库 cip；请使用隔离库" >&2
  exit 1
fi
docker exec -i "$CONTAINER" psql -U "$PG_USER" -d "$DB" -v ON_ERROR_STOP=1 < "$FILE" >/dev/null
echo "restore: $FILE -> $DB"
