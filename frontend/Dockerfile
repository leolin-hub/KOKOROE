# 前端 image：建置階段用 Node 產生 dist/，執行階段是 Caddy，負責：
#   1. 提供 dist/ 的靜態檔（含 SPA fallback）
#   2. 把 /api/* 與 /actuator/health 轉給 backend 容器
# 設定在同目錄的 Caddyfile。HTTPS 由 Cloudflare Tunnel 負責，Caddy 只在 VM 內部說 HTTP。
#
# 建置：docker build -t kokoroe-web frontend

# ---- 建置階段 ----
# 靜態檔與 CPU 架構無關：--platform=$BUILDPLATFORM 讓這一階段在建置機的原生架構上跑，
# 建 arm64 image 時不用經過 QEMU 模擬來跑 npm，快很多。
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# 同網域部署，API 用預設的相對路徑 /api/v1，不需要設定 VITE_API_BASE_URL。
RUN npm run build

# ---- 執行階段 ----
FROM caddy:2-alpine
# 官方 image 的 caddy 執行檔帶有「可綁 1024 以下 port」的 file capability。
# compose 用一般使用者跑、又丟掉全部 capability，kernel 給不出這個權限，就會直接拒絕執行
# （exec: operation not permitted）。我們聽 8080 用不到它，拿掉。
RUN setcap -r /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
