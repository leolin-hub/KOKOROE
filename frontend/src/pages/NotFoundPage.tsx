import { Link } from 'react-router'

/**
 * 前端路由找不到對應頁面時的兜底。
 *
 * 注意這跟 API 的 404 是兩件不同的事：
 *   - 這一頁：**網址**沒有對應的路由（例如 /fim-rolls 打錯字）
 *   - API 404：網址對、路由對，但**資源**不存在（由詳情頁自己處理）
 *
 * 兩者的文案與出路都不一樣，所以不該共用同一個元件。
 *
 * 這一頁我寫完了 —— 沒有需要練習的東西。
 */
export default function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-3)' }}>找不到這個頁面</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>
        網址可能打錯了，或這個頁面已經不存在。
      </p>
      <Link to="/film-rolls">回到卷期列表</Link>
    </div>
  )
}
