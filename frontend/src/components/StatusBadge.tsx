import { STATUS_LABELS } from '../lib/constants'
import type { FilmRollStatus } from '../types/filmRoll'
import styles from './StatusBadge.module.css'

interface StatusBadgeProps {
  status: FilmRollStatus
}

/**
 * 狀態 → CSS class 的明確對應表。
 *
 * 不用 `styles[status.toLowerCase()]` 動態拼接：那樣 CSS class 與狀態值之間沒有編譯期關聯，
 * 有人把 `.loaded` 改名時 TypeScript 不會知道，badge 只會默默失去顏色。
 * `Record<FilmRollStatus, string>` 則會在新增狀態時強迫補上對應的 class。
 */
const STATUS_CLASS: Record<FilmRollStatus, string> = {
  LOADED: styles.loaded,
  SHOOTING: styles.shooting,
  DEVELOPING: styles.developing,
  ARCHIVED: styles.archived,
}

/**
 * 狀態標籤（已裝片 / 拍攝中 / 沖洗中 / 已歸檔），每個狀態有自己的顏色。
 *
 * 【影響畫面】列表頁每張卡片的右上角、詳情頁標題旁邊。
 */
export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${STATUS_CLASS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}
