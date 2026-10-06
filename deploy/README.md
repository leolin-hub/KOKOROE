# 部署手冊

kokoroe 正式環境：一台 Oracle Cloud 免費 VM、docker compose、Cloudflare Tunnel 與 Access，照片放 Cloudflare R2。

```
瀏覽器 ─HTTPS→ Cloudflare（Access：只有白名單 email 能進）
                 │
                 └─Tunnel（VM 主動連出去，VM 不開任何 inbound port）
                      │
Oracle VM ─ cloudflared（systemd）─→ 127.0.0.1:8080 ─→ web（Caddy：靜態檔、/api 轉發）
                                                       └─→ backend（Spring Boot）─→ postgres
                                                                    └──────────────→ Cloudflare R2（照片）
GitHub Actions ─ CI 綠燈 → 建 arm64 image 推到 GHCR → 經 Tunnel SSH 進 VM → docker compose up
```

| 檔案 | 用途 |
|---|---|
| `compose.prod.yml` | 正式環境的三個服務；沒有對外的 port |
| `.env.example` | 機密的範本。VM 上複製成 `.env`，不進 git |
| `backup.sh` | 每日 `pg_dump` → 上傳 R2 |
| `restore-test.sh` | 把備份還原到用完即丟的容器，驗證備份能用 |
| `../backend/Dockerfile`、`../frontend/Dockerfile`、`../frontend/Caddyfile` | 兩個 image |
| `../.github/workflows/deploy.yml` | CD |

**費用**：網域免費（DigitalPlat）、VM 免費（Oracle Always Free）、Cloudflare Tunnel／Access 免費（50 人以內）、R2 前 10 GB 免費。Oracle 和 R2 都要綁信用卡，但不會扣款。

> **在步驟 4（`owner_id`）完成前，Access 白名單只能放自己的 email。** 目前所有人看到的是同一份資料，朋友進來就能改你的紀錄。

下面的 `<網域>` 代表你申請到的網域，例如 `kokoroe.dpdns.org`。

---

## 一次性設定

依序做。每一步最後都有「確認」，確認過了再往下。

### 1. 網域 → Cloudflare

1. 到 Cloudflare 註冊帳號，**Add a domain**，填完整的 `<網域>`，方案選 **Free**。記下它給的兩個 nameserver（`xxx.ns.cloudflare.com`）。
2. 到 [DigitalPlat FreeDomain](https://domain.digitalplat.org/) 註冊網域（建議 `.dpdns.org`），nameserver **只填** Cloudflare 給的那兩個。
3. 等 Cloudflare 那邊顯示 **Active**（幾分鐘到幾小時）。

確認：`nslookup -type=ns <網域>` 回的是 Cloudflare 的 nameserver。

### 2. Cloudflare Zero Trust

1. Cloudflare 後台 → **Zero Trust**，取一個 team name，方案選 **Free**（可能要綁卡，金額是 $0）。
2. **Settings → Authentication**：確認有 **One-time PIN**（輸入 email 收驗證碼登入，不用另外設定帳號系統）。
3. 回到網域的設定頁 → **SSL/TLS → Edge Certificates**：打開 **Always Use HTTPS**，並啟用 **HSTS**（max-age 6 個月即可）。

### 3. Cloudflare R2

1. 後台 → **R2** → 啟用（要綁卡）。記下右側的 **Account ID**。
2. 建兩個 bucket，Location 選 **Asia-Pacific**：
   - `kokoroe-photos`：照片
   - `kokoroe-backups`：資料庫備份。進 bucket 的 **Settings**：
     - **Object lifecycle rules**：加一條「30 天後刪除」。
     - **Bucket lock rules**（**必做**）：鎖 30 天。Object Read & Write 金鑰本身就能刪除、覆寫檔案，
       VM 被入侵時，入侵者可以用 VM 上的備份金鑰清光所有備份；有 bucket lock，鎖定期間內任何金鑰都刪不掉。
3. **Manage API tokens → Create API token**，建兩組，權限都選 **Object Read & Write**，各自只套用在一個 bucket：
   - `kokoroe-photos` 用的 → 填進 `.env` 的 `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`
   - `kokoroe-backups` 用的 → `BACKUP_ACCESS_KEY` / `BACKUP_SECRET_KEY`

   Secret 只會顯示一次，先貼到密碼管理器。

### 4. Oracle Cloud VM

1. 註冊 Oracle Cloud。**Home region 選了就不能改**，選離台灣近的：Japan East (Tokyo)、Japan Central (Osaka)、Singapore 或 South Korea North (Chuncheon)。
2. 註冊完成後 **升級成 Pay As You Go**（Billing → Upgrade）。仍然只用 Always Free 的額度就不會收錢，但有兩個好處：
   - 免費帳號的 VM 若連續 7 天幾乎沒在用，會被 Oracle 回收；升級後不會。
   - 建 ARM VM 時比較不會遇到「Out of capacity」。

   升級後到 **Budgets** 設一個 US$1 的預算警示，有任何意外的花費會寄信通知。
3. **Create instance**：
   - Image：**Canonical Ubuntu 24.04**（aarch64）
   - Shape：**VM.Standard.A1.Flex**，2 OCPU / 12 GB（免費額度是合計 4 OCPU / 24 GB）
   - Boot volume：50 GB
   - SSH key：上傳你電腦的公鑰（`~/.ssh/id_ed25519.pub`）
   - 保留 public IP（VM 要靠它連出去）
4. 用 `ssh ubuntu@<public IP>` 連進去，安裝 Docker：

   ```bash
   sudo apt update && sudo apt full-upgrade -y
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker ubuntu   # 重新登入後生效
   mkdir -p ~/kokoroe
   ```

   Ubuntu 預設就開著 `unattended-upgrades`，安全性更新會自動裝。
5. Oracle 後台 → 這台 VM → **Instance metadata service** → **Edit** → 選 **Allow only version 2 endpoints**。
   backend 容器要連外（R2），也就連得到 VM 的 metadata 位址 `169.254.169.254`；只允許 v2 可以擋掉最常見的 SSRF 取資料手法。

確認：重新登入後，`docker run --rm hello-world` 成功，而且 `uname -m` 是 `aarch64`。

### 5. Cloudflare Access

**先建 Access，再建 Tunnel 的 hostname。** 反過來的話，從 hostname 建好到 Access 生效之間，網站和 SSH 對整個網際網路是開著的。
Access application 可以在 hostname 還不存在時先建立。

1. Zero Trust → **Access → Service credentials → Service Tokens → Create**，取名 `github-deploy`。記下 Client ID 與 Client Secret（只顯示一次）。
2. **Access → Applications → Add → Self-hosted**，建三個：

   | 名稱 | Domain | Policy |
   |---|---|---|
   | kokoroe | `<網域>` | Allow — Include **Emails**：你自己的 email。Session duration 設 1 個月 |
   | kokoroe health | `<網域>/actuator/health` | Bypass — Include **Everyone**（給外部監控打；這個端點只回 `{"status":"UP"}`） |
   | kokoroe ssh | `ssh.<網域>` | ① **Service Auth** — Include **Service Token** `github-deploy`<br>② Allow — Include **Emails**：你自己的 email |

3. 在 **kokoroe** 這個 application 的 **Settings → Cookies**，把 **SameSite Attribute** 設成 **Lax**。
   這樣別的網站在背景對 kokoroe 發請求時，瀏覽器不會帶上你的登入狀態（Caddy 也另外擋了跨站的 `/api` 請求，這是第二道）。

### 6. Cloudflare Tunnel

1. Zero Trust → **Networks → Tunnels → Create a tunnel** → 類型 **Cloudflared**，取名 `kokoroe`。
2. 環境選 **Debian / arm64**，照畫面上的指令在 VM 上安裝 cloudflared，最後一行是：

   ```bash
   sudo cloudflared service install <token>
   ```

   cloudflared 刻意裝在 VM 本機（systemd），不放進 docker compose：compose 那套出問題時，SSH 的通道還在。
3. **Public hostnames** 加兩筆：

   | Hostname | Service |
   |---|---|
   | `<網域>` | `HTTP` → `localhost:8080` |
   | `ssh.<網域>` | `SSH` → `localhost:22` |

確認：

- Tunnel 狀態是 **Healthy**。
- 無痕視窗打開 `https://<網域>`，會跳到 Cloudflare 的登入頁，而不是網站本身。（網站還沒部署，登入後看到 502 是正常的。）

### 7. 從自己的電腦經 Tunnel SSH 進 VM

```powershell
winget install --id Cloudflare.cloudflared
```

在 `~/.ssh/config` 加上：

```
Host kokoroe
  HostName ssh.<網域>
  User ubuntu
  ProxyCommand cloudflared access ssh --hostname %h
```

`ssh kokoroe` 第一次會開瀏覽器要你用 email 登入。

確認可以連進去之後，**關掉 22 port**：Oracle 後台 → VM 的 subnet → **Security List** → 刪掉 port 22 的 ingress rule。之後 VM 沒有任何對外開放的 port，所有連線都要經過 Access。

### 8. 部署用的 SSH key 與 GitHub 設定

在自己的電腦產生一組只給 GitHub Actions 用的 key：

```bash
ssh-keygen -t ed25519 -f kokoroe-deploy -C github-deploy -N ""
ssh-copy-id -i kokoroe-deploy.pub kokoroe     # 或手動把 .pub 內容加到 VM 的 ~/.ssh/authorized_keys
```

再到 VM 的 `~/.ssh/authorized_keys`，在 `github-deploy` 那一行最前面加上 `restrict `（後面有一個空格）：

```
restrict ssh-ed25519 AAAA... github-deploy
```

`restrict` 會關掉這把 key 的 port forwarding、agent forwarding 與互動式終端機。部署只需要執行指令和傳檔，用不到這些功能；
這把 key 萬一外洩，能做的事也少一些。

在 VM 上取得 host key，給 GitHub 驗證「連到的真的是這台」：

```bash
echo "ssh.<網域> $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"
```

GitHub repo → **Settings → Environments → New environment** `production`：

- **Deployment branches**：Selected branches → `main`
- **Required reviewers**（選填）：加自己，每次部署前要按核准
- **Environment secrets**：

  | 名稱 | 值 |
  |---|---|
  | `SSH_PRIVATE_KEY` | `kokoroe-deploy` 檔案的完整內容 |
  | `SSH_KNOWN_HOSTS` | 上面 `echo` 印出的那一行 |
  | `CF_ACCESS_CLIENT_ID` | service token 的 Client ID |
  | `CF_ACCESS_CLIENT_SECRET` | service token 的 Client Secret |

- **Environment variables**：`SSH_HOST` = `ssh.<網域>`、`SSH_USER` = `ubuntu`

設好之後，本機的 `kokoroe-deploy` 私鑰可以刪掉。

### 9. VM 上的 `.env`

```bash
cd ~/kokoroe
nano .env        # 貼上 .env.example 的內容並填值
chmod 600 .env
```

`DB_PASSWORD` 用 `openssl rand -base64 32 | tr -d '/+='` 產生。

### 10. 第一次部署

1. 打開部署開關：GitHub repo → **Settings → Secrets and variables → Actions → Variables** 分頁 →
   **New repository variable**，名稱 `DEPLOY_ENABLED`、值 `true`。
   沒設這個變數時，`deploy.yml` 整個跳過（前面幾步還沒做完時，merge 進 main 不會一直部署失敗）。
   之後想暫停自動部署，把它改成 `false` 就好。
2. GitHub → **Actions → Deploy → Run workflow**（branch：main）。
3. `build` 會成功，`deploy` 第一次會在 pull image 時失敗：GHCR 新建的 package 預設是 private。
   到 GitHub 個人頁 → **Packages**，把 `kokoroe-backend` 和 `kokoroe-web` 都改成 **Public**（Package settings → Change visibility）。
   repo 本身就是公開的，image 裡沒有任何機密，公開沒有問題。
4. 回到那次 workflow run，**Re-run failed jobs**。

之後每次 merge 進 main、CI 綠燈，就會自動部署。

確認：

- [ ] `https://<網域>` 登入後看得到網站，重新整理 `/film-rolls/1` 這種網址不會 404
- [ ] 新增一台相機、一卷底片、上傳一張照片，看得到縮圖，然後全部刪掉
- [ ] R2 的 `kokoroe-photos` 裡有出現、也有消失對應的檔案
- [ ] `https://<網域>/actuator/health` 不用登入就回 `{"status":"UP"}`

### 11. 備份

```bash
cd ~/kokoroe
./backup.sh                                   # 先手動跑一次
./restore-test.sh ~/kokoroe-backups/kokoroe-*.dump   # 還原演練，筆數要跟網站上一致
crontab -e
```

加上這一行（每天台灣時間 11:15，也就是 UTC 03:15）：

```
15 3 * * * $HOME/kokoroe/backup.sh >> $HOME/kokoroe-backups/backup.log 2>&1
```

確認：隔天 R2 的 `kokoroe-backups/db/` 裡多了一個檔案。**每隔幾個月再跑一次 `restore-test.sh`。**

### 12. 監控

- **網站**：[UptimeRobot](https://uptimerobot.com/) 免費方案建一個 HTTP monitor，網址 `https://<網域>/actuator/health`，每 5 分鐘一次，掛掉時寄 email。
- **備份**：cron 失敗時不會有人知道。[healthchecks.io](https://healthchecks.io/) 免費方案建一個 check（週期 1 天、寬限 2 小時），
  把它給的網址填進 `.env` 的 `BACKUP_PING_URL`。`backup.sh` 每次成功都會打一下，哪天沒打就寄信通知。

---

## 日常操作

在 VM 上（`ssh kokoroe`，然後 `cd ~/kokoroe`）：

| 要做的事 | 指令 |
|---|---|
| 看狀態 | `docker compose -f compose.prod.yml ps` |
| 看 log | `docker compose -f compose.prod.yml logs -f --tail=100 backend` |
| 改了 `.env` 之後套用 | `docker compose -f compose.prod.yml up -d` |
| 回滾到某個 commit | 把 `.env` 的 `IMAGE_TAG=` 改成那個 commit 的 SHA，再 `docker compose -f compose.prod.yml up -d` |

`IMAGE_TAG` 每次部署都會被 `deploy.yml` 寫進 `.env`，所以手動 `up -d`、VM 重開機之後，跑的都還是最後部署的版本。
| 進資料庫 | `docker compose -f compose.prod.yml exec postgres psql -U kokoroe` |

回滾只換程式，不會倒回資料庫的 migration。如果新版加了 migration，舊版程式可能對不上新的 schema（Hibernate 啟動時的 `validate` 會擋下來），這時要從備份還原。

## 已知限制

- **Access 登入過期時**，頁面上的 API 請求會失敗（被導向登入頁，瀏覽器擋下跨網域的轉址），畫面上會出現錯誤訊息。重新整理頁面就會跳到登入頁。
- **上傳上限**：一張 40 MB。Cloudflare 免費方案單一請求上限 100 MB，不受影響。

## 在本機試跑正式組態

不推到 GHCR、不連 R2，用本機建的 image 加上開發用的 RustFS：

```bash
docker build -t ghcr.io/leolin-hub/kokoroe-backend:local backend
docker build -t ghcr.io/leolin-hub/kokoroe-web:local frontend
docker compose up -d rustfs                           # repo 根目錄的開發用 compose
# 在 RustFS 管理介面（http://localhost:9001）建一個 bucket，例如 kokoroe-prodtest
```

在另一個資料夾放 `compose.prod.yml` 的副本與 `.env`：`STORAGE_ENDPOINT=http://host.docker.internal:9000`，
金鑰用開發用的 `kokoroe` / `kokoroe-secret`，`WEB_PORT=8088`（避開本機開發的 8080），然後：

```bash
IMAGE_TAG=local docker compose -p kokoroe-prodtest -f compose.prod.yml up -d --wait
curl http://127.0.0.1:8088/actuator/health
```

測完記得 `docker compose -p kokoroe-prodtest -f compose.prod.yml down`，再 `docker volume rm kokoroe-pgdata-prod`。
