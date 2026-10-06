#!/usr/bin/env bash
# 資料庫每日備份：pg_dump → VM 本機留 7 天 → 上傳到 Cloudflare R2 的備份 bucket。
#
# 由 cron 每天執行一次（安裝方式見 deploy/README.md）：
#   15 3 * * * $HOME/kokoroe/backup.sh >> $HOME/kokoroe-backups/backup.log 2>&1
#
# R2 上的舊備份不由這支腳本刪除，而是交給 bucket 的 lifecycle rule（30 天自動刪除）。
# 注意 Object Read & Write 金鑰本身有刪除權限：VM 被入侵時，光靠「腳本不刪」擋不住任何事。
# 真正保護備份的是 bucket lock（deploy/README.md 第 3 步，必做）：鎖定期間內任何金鑰都刪不掉、蓋不掉。
#
# 只備份資料庫。照片本來就在 R2，不在 VM 上。

set -euo pipefail

cd "$(dirname "$0")"
# 讀 .env 並 export。.env 會被當成 shell 執行，值裡有空白或 $ 時要用單引號包起來
set -a
. ./.env
set +a

backup_dir="${BACKUP_DIR:-$HOME/kokoroe-backups}"
local_days=7
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
name="kokoroe-$stamp.dump"

# 備份檔裡有全部資料，只有自己讀得到
umask 077
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"

echo "[$(date -u +%FT%TZ)] 開始備份 $name"

# custom 格式：有壓縮，還原時可以只挑部分資料表。
# 先寫到 .partial，成功才改名，避免半個檔案被當成有效備份；中途失敗就把 .partial 清掉。
trap 'rm -f "$backup_dir/$name.partial"' EXIT
docker compose -f compose.prod.yml exec -T postgres \
  pg_dump --username="$DB_USER" --dbname="$DB_NAME" --format=custom \
  > "$backup_dir/$name.partial"
mv "$backup_dir/$name.partial" "$backup_dir/$name"

# 讀一次目錄確認檔案結構完整；壞掉的備份要在今天發現，不是在需要還原的那天
docker compose -f compose.prod.yml exec -T postgres pg_restore --list \
  < "$backup_dir/$name" > /dev/null

# rclone 的設定全部用環境變數給，不用在 VM 上另外寫設定檔。
# 金鑰先 export，docker run -e 只寫變數名稱，值就不會出現在指令列上（ps 看得到指令列）。
# no_check_bucket：金鑰只有物件權限，沒辦法查 bucket 是否存在，跳過這個檢查。
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$BACKUP_ACCESS_KEY"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$BACKUP_SECRET_KEY"

docker run --rm \
  -v "$backup_dir:/backups:ro" \
  -e RCLONE_CONFIG_R2_TYPE=s3 \
  -e RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
  -e RCLONE_CONFIG_R2_ENDPOINT="$STORAGE_ENDPOINT" \
  -e RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true \
  -e RCLONE_CONFIG_R2_ACCESS_KEY_ID -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY \
  rclone/rclone:1 \
  copyto "/backups/$name" "r2:$BACKUP_BUCKET/db/$name"

# 本機只留最近幾天，R2 上的才是正本
find "$backup_dir" -maxdepth 1 -name 'kokoroe-*.dump' -mtime +"$local_days" -delete

echo "[$(date -u +%FT%TZ)] 完成：$(du -h "$backup_dir/$name" | cut -f1)，已上傳 r2:$BACKUP_BUCKET/db/$name"

# cron 失敗時不會有人發現。設了 BACKUP_PING_URL（例如 healthchecks.io）就在成功時打一下，
# 哪天沒收到，那邊會寄信通知
if [ -n "${BACKUP_PING_URL:-}" ]; then
  curl -fsS --max-time 10 --retry 3 "$BACKUP_PING_URL" > /dev/null
fi
