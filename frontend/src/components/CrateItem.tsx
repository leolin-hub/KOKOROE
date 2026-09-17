import type { FilmRollResponse } from '../types/filmRoll'
import styles from './CrateItem.module.css'

interface CrateItemProps {
  roll: FilmRollResponse
  /**
   * 這一卷相對於焦點卷期的位置：`index - focusedIndex`。
   * 0 是焦點本身，-1 是焦點的上一卷，2 是下兩卷，依此類推。
   */
  offset: number
}

/**
 * 唱片櫃裡的一格。
 *
 * 【影響畫面】唱片櫃瀏覽頁（/crate）裡的每一卷。焦點卷期放大、顯示完整資訊；
 *   其他卷期往後傾、縮小、變淡，只露出外觀與標題。
 *   傾斜與縮放全部寫在 `CrateItem.module.css`（已完成），這個元件只負責把 `offset` 翻譯成 CSS 看得懂的兩個值。
 *
 * 【會用到】
 *   - `Link`                                         'react-router'            ← 要自己 import
 *   - `CSSProperties`（type）                         'react'                   ← 要自己 import type
 *   - `RollArtwork`                                   './RollArtwork'           ← 要自己 import
 *   - `StatusBadge`                                   './StatusBadge'           ← 要自己 import
 *   - `formatRollTitle`、`formatDate`                 '../lib/format'           ← 要自己 import
 *   - `FORMAT_OPTIONS`（找規格的顯示文字，可選）        '../lib/constants'        ← 要自己 import
 *   - styles：`slot`、`record`、`artworkLink`、`info`、`title`、`meta`、`details`、`detailLink`
 *
 * 【步驟】
 * 1. 把參數改成解構 `{ roll, offset }`，刪掉 `void props` 與佔位的 `<li>`。
 * 2. 算出 CSS 需要的兩個值：
 *    - `const position = offset === 0 ? 'focused' : offset < 0 ? 'before' : 'after'`
 *    - `const distance = Math.min(Math.abs(offset), 3)`（超過 3 格一律算 3，太遠的不用再更斜）
 * 3. 外層是 `<li>`（頁面用 `<ol>` 包起來）：
 *    ```tsx
 *    <li
 *      className={styles.slot}
 *      data-position={position}
 *      style={{ '--distance': distance } as CSSProperties}
 *      aria-current={offset === 0 ? 'true' : undefined}
 *    >
 *    ```
 * 4. 裡面一個 `<div className={styles.record}>`，分左右兩塊：
 *    - 左：`<Link to={`/film-rolls/${roll.id}`} className={styles.artworkLink} ...>` 包住 `<RollArtwork roll={roll} />`
 *      （步驟 3 做照片檢視後，這個連結會改成「攤開這卷的照片」；現在先去詳情頁）
 *    - 右：`<div className={styles.info}>` 裡放
 *        `<h2 className={styles.title}>` 標題（formatRollTitle）
 *        `<p className={styles.meta}>` 一行規格：`ISO 400 · 135 · PENTAX PG-50`（沒有相機就不顯示那一段）
 *        `<div className={styles.details}>` 收起來的詳細資訊：StatusBadge、裝片日期（formatDate）、「查看詳情 →」連結
 *
 * 【坑】
 * - `style={{ '--distance': distance }}` 直接寫會型別錯誤：React 的 `CSSProperties` 不認得自訂屬性。
 *   要 `as CSSProperties` 轉型。這是 React + TypeScript 設 CSS 變數的標準寫法。
 * - 非焦點卷期的連結要加 `tabIndex={offset === 0 ? undefined : -1}`：
 *   不加的話，按 Tab 會一路經過櫃子裡每一卷的每個連結（20 卷就是 40 次 Tab），
 *   而且焦點會跳到看不見（被 CSS 收起來）的連結上。只讓焦點卷期的連結能被 Tab 到。
 * - 左邊圖片連結裡沒有文字，要加 `aria-label={`${title} 詳情`}`，不然螢幕閱讀器只會念「連結」。
 * - 一行規格用陣列組：`[`ISO ${roll.iso}`, formatLabel, roll.camera?.name].filter(Boolean).join(' · ')`，
 *   不要用一串 `&&` 拼字串，沒有相機時會多出一個 ` · ` 或 `undefined`。
 */
export default function CrateItem(props: CrateItemProps) {
  void props
  return <li className={styles.slot}>TODO(你來寫)：CrateItem</li>
}
