#!/usr/bin/env bash
# 備份還原演練：把一份 pg_dump 還原到一個用完即丟的 PostgreSQL 容器，印出各資料表筆數。
# 不會碰到正式資料庫。
#
#   ./restore-test.sh ~/kokoroe-backups/kokoroe-20261007T031500Z.dump
#
# 沒實際還原過的備份不算備份。上線後至少跑一次，之後每隔幾個月再跑一次。

set -euo pipefail

dump="${1:?用法：$0 <dump 檔>}"
[ -r "$dump" ] || { echo "讀不到 $dump" >&2; exit 1; }

# 跟正式環境用同一個 PostgreSQL image，compose.prod.yml 升版時這裡自動跟上
image="$(grep -m1 -oE 'postgres:[^[:space:]]+' "$(dirname "$0")/compose.prod.yml")"

container=kokoroe-restore-test
docker run --detach --rm --name "$container" \
  -e POSTGRES_PASSWORD=restore-test -e POSTGRES_DB=restore \
  "$image" > /dev/null
trap 'docker stop "$container" > /dev/null' EXIT

# 用 TCP 檢查：映像初始化期間的暫時 server 只聽 unix socket，
# 等 TCP 通了才是初始化完、真正可以用的那個 server。最多等 60 秒，容器掛掉時不會卡住
ready=false
for _ in $(seq 60); do
  if docker exec "$container" pg_isready --host=127.0.0.1 --username=postgres > /dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
$ready || { echo "PostgreSQL 60 秒內沒有啟動" >&2; exit 1; }

# --no-owner：正式環境的使用者 kokoroe 在這個測試資料庫裡不存在，物件一律歸 postgres
docker exec -i "$container" pg_restore --username=postgres --dbname=restore \
  --no-owner --exit-on-error < "$dump"

# 之後新增資料表（例如 film_stock）時，這裡也要加上
docker exec "$container" psql --username=postgres --dbname=restore --command="
  SELECT 'camera' AS 資料表, count(*) AS 筆數 FROM camera
  UNION ALL SELECT 'film_roll', count(*) FROM film_roll
  UNION ALL SELECT 'photo', count(*) FROM photo;"
docker exec "$container" psql --username=postgres --dbname=restore --command="
  SELECT max(version::int) AS 最新的_migration FROM flyway_schema_history WHERE success;"

echo "還原成功。比對上面的筆數與正式站上看到的是否一致。"
