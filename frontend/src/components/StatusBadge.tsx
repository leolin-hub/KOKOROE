import { STATUS_LABELS } from '../lib/constants'
import type { FilmRollStatus } from '../types/filmRoll'
import styles from './StatusBadge.module.css'

interface StatusBadgeProps {
  status: FilmRollStatus
}

/**
 * 狀態標籤。列表卡片與詳情頁都會用。
 *
 * TODO(你來寫)：這是最小的一個元件，適合當暖身。
 *
 * ```tsx
 * return (
 *   <span className={`${styles.badge} ${styles[status.toLowerCase()]}`}>
 *     {STATUS_LABELS[status]}
 *   </span>
 * )
 * ```
 *
 * ⚠️ 上面那個 `styles[status.toLowerCase()]` 有兩個問題，值得停下來想：
 *
 * 1. **型別上不安全**：`toLowerCase()` 回傳 `string`，而 `styles` 的鍵是已知的
 *    有限集合。TypeScript 會抱怨用 string 當索引。
 *
 * 2. **重構時會靜默失效**：CSS 裡的 class 名稱與 enum 值之間沒有任何
 *    編譯期的關聯。哪天有人把 `.loaded` 改名，TypeScript 完全不會知道，
 *    你只會看到 badge 沒有顏色 —— 而且不會有錯誤訊息。
 *
 * 更穩的做法是明確列出對應關係：
 *
 * ```ts
 * const STATUS_CLASS: Record<FilmRollStatus, string> = {
 *   LOADED: styles.loaded,
 *   SHOOTING: styles.shooting,
 *   DEVELOPING: styles.developing,
 *   ARCHIVED: styles.archived,
 * }
 * ```
 *
 * 多打幾行字，換來的是「新增一個狀態時 TypeScript 會強迫你補上顏色」。
 * `Record<FilmRollStatus, ...>` 的 exhaustiveness 檢查就是為這個而存在。
 *
 * 這個取捨（動態字串拼接 vs. 明確對應表）在整個前端會反覆出現，
 * 這裡只是規模最小的一次。
 */
const STATUS_CLASS: Record<FilmRollStatus, string> = {
    LOADED: styles.loaded,
    SHOOTING: styles.shooting,
    DEVELOPING: styles.developing,
    ARCHIVED: styles.archived,
  }

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${STATUS_CLASS[status]}`}>
      {STATUS_LABELS[status]}
    </span>

  )
}
