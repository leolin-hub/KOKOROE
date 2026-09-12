import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 開發時把 /api/** 轉給後端的 8080。
      //
      // 為什麼用 proxy 而不是直接打 http://localhost:8080：
      // 瀏覽器眼中前端與 API 變成同源，於是完全不需要在後端開 CORS，
      // 也不會有 preflight。正式環境通常由 Nginx / Cloudflare 做同一件事，
      // 所以這個做法跟部署形態是一致的，而非只是開發期的權宜。
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
