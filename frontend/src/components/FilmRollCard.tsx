import { Link } from 'react-router'
import StatusBadge from './StatusBadge'
import { formatDate, formatPushPull, formatRollTitle } from '../lib/format'
import type { FilmRollResponse } from '../types/filmRoll'
import styles from './FilmRollCard.module.css'

interface FilmRollCardProps {
  roll: FilmRollResponse
}

/**
 * 列表上的單張卷期卡片。
 *
 * TODO(你來寫)：
 *
 * 結構建議：
 * ```tsx
 * <Link to={`/film-rolls/${roll.id}`} className={styles.card}>
 *   <div className={styles.header}>
 *     <h2 className={styles.title}>{formatRollTitle(roll.filmName, roll.brand)}</h2>
 *     <StatusBadge status={roll.status} />
 *   </div>
 *   <dl className={styles.meta}>
 *     ... ISO / 規格 / 增減感 / 裝片日期 / 相機
 *   </dl>
 * </Link>
 * ```
 *
 * ── 三個需要判斷的地方 ──
 *
 * **1. 整張卡片包成 Link，還是只有標題是 Link？**
 *
 * 整張可點的操作範圍大、手機上好按。但要注意：
 * `<a>` 裡面**不能**再放 `<a>` 或 `<button>`（HTML 規範不允許互動元素嵌套，
 * React 不會報錯，但瀏覽器行為與鍵盤操作會出問題）。
 * 所以如果你之後想在卡片上加「快速刪除」按鈕，就得改成
 * 「卡片不是 Link，只有標題是」。
 * 現在沒有那個需求 —— 選整張可點，但記得這個限制的存在。
 *
 * **2. optional 欄位怎麼處理？**
 *
 * `brand` / `cameraName` / `lensName` / `notes` 都可能不存在
 * （後端 non_null，null 欄位不會出現在 JSON 裡）。
 *
 * 卡片上該「顯示佔位符 —」還是「整列不顯示」？
 * 建議：卡片上**不顯示**（資訊密度優先，一堆破折號很吵），
 * 詳情頁**顯示佔位符**（使用者需要知道「這個欄位是空的」而不是「不存在」）。
 * 同一份資料在不同密度的介面該有不同呈現，這是很常見的取捨。
 *
 * **3. 用 `<dl>` 還是一堆 `<div>`？**
 *
 * 「ISO: 400」這種資料本質上是名稱→值的對應，`<dl>/<dt>/<dd>` 就是為它而生的。
 * 螢幕閱讀器會把它讀成有結構的清單而不是一串散字。
 * 語意化 HTML 的成本在這裡幾乎是零 —— 一樣的字數，換來可存取性。
 *
 * 💡 `<dl>` 的預設樣式有 margin 與縮排，記得在 CSS 裡歸零。
 */
export default function FilmRollCard({ roll }: FilmRollCardProps) {
  throw new Error(`TODO: 實作 FilmRollCard（roll #${roll.id}: ${roll.filmName}）`)
}
