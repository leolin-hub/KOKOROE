import { SORT_OPTIONS, STATUS_LABELS, STATUS_ORDER } from '../lib/constants'
import type { FilmRollStatus } from '../types/filmRoll'
import styles from './FilmRollFilters.module.css'

interface FilmRollFiltersProps {
  /** 目前的狀態篩選。`undefined` 代表「全部」。 */
  status: FilmRollStatus | undefined
  /** 目前的排序，例如 `'loadedAt,desc'`。 */
  sort: string
  onStatusChange: (status: FilmRollStatus | undefined) => void
  onSortChange: (sort: string) => void
}

/**
 * 列表頁的篩選與排序控制列。
 *
 * 這是個**受控元件**（controlled component）：它自己不存任何狀態，
 * 值從 props 來、改變透過 callback 往上送。
 * 真相存在列表頁的 URL 裡（見 FilmRollListPage）。
 *
 * 為什麼要這樣：如果這個元件自己用 useState 存 status，
 * 就會有兩份真相 —— URL 一份、元件一份，然後它們會不同步。
 * 使用者按上一頁時 URL 變了但元件沒變，畫面就會騙人。
 *
 * TODO(你來寫)：
 *
 * ### 狀態篩選
 *
 * 兩種做法都可以，選一個：
 *
 * (a) 一排按鈕（`全部 / 已裝片 / 拍攝中 / 沖洗中 / 已歸檔`）
 *     —— 一眼看得到所有選項，手機上也好按，目前狀態用 aria-pressed 表示。
 *     提示：`STATUS_ORDER.map(s => ...)`，前面再手動加一個「全部」。
 *
 * (b) 一個 `<select>`
 *     —— 省空間，但要多點一下才看得到選項。
 *
 * 四個選項用 (a) 比較好；如果之後狀態變成十幾種，就該換 (b)。
 *
 * ⚠️ 「全部」的 value 要怎麼表達？`<select>` 的 value 只能是字串，
 *    不能是 undefined。慣例是用空字串 `''`，然後在 onChange 轉換：
 *    ```ts
 *    const value = e.target.value
 *    onStatusChange(value === '' ? undefined : (value as FilmRollStatus))
 *    ```
 *    這個 `''` ↔ `undefined` 的轉換必須發生在**邊界**（也就是這裡），
 *    不要讓空字串流進 API 層 —— 那會變成 `?status=` 然後 400。
 *
 * ### 排序
 *
 * 直接 map `SORT_OPTIONS` 成 `<option>`。這個用 `<select>` 就好，
 * 五個排序方式做成按鈕會太佔空間。
 *
 * ### 可存取性
 *
 * `<select>` 一定要有對應的 `<label>`（或 `aria-label`）。
 * 沒有 label 的下拉選單，螢幕閱讀器只會讀出目前選中的值，
 * 使用者不知道這個下拉是在控制什麼。
 * 如果視覺上不想顯示 label，用 index.css 裡的 `.visually-hidden`。
 */
export default function FilmRollFilters({
  status,
  sort,
  onStatusChange,
  onSortChange,
}: FilmRollFiltersProps) {
  throw new Error(`TODO: 實作 FilmRollFilters（status: ${status ?? '全部'}, sort: ${sort}）`)
}
