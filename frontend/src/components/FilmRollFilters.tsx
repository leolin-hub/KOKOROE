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
 * 狀態按鈕的清單：「全部」加上依流程順序的四個狀態。
 *
 * 按鈕的 value 可以直接是 `undefined`，不像 `<select>` 只能用 `''` 代表「全部」，
 * 所以這裡不需要 `''` ↔ `undefined` 的轉換。
 */
const STATUS_FILTERS: readonly { value: FilmRollStatus | undefined; label: string }[] = [
  { value: undefined, label: '全部' },
  ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
]

/**
 * 列表頁的篩選與排序控制列。
 *
 * **受控元件**：自己不存任何狀態，值從 props 來、改變透過 callback 往上送。
 * 真相只有一份，存在列表頁的 URL 裡；元件自己再存一份的話，
 * 使用者按上一頁時 URL 變了但元件沒變，畫面就會騙人。
 *
 * - 狀態用一排按鈕：只有五個選項，一眼看得到、手機上好按。
 *   選中的按鈕用 `aria-pressed` 告訴螢幕閱讀器。狀態變成十幾種時再改成 `<select>`。
 * - 排序用 `<select>`：五個選項做成按鈕太佔空間。
 *   `<select>` 包在 `<label>` 裡，螢幕閱讀器才知道這個下拉在控制什麼。
 */
export default function FilmRollFilters({
  status,
  sort,
  onStatusChange,
  onSortChange,
}: FilmRollFiltersProps) {
  return (
    <div className={styles.filters}>
      <div className={styles.statusGroup} role="group" aria-label="依狀態篩選">
        {STATUS_FILTERS.map(({ value, label }) => {
          const active = status === value
          return (
            <button
              key={value ?? 'ALL'}
              type="button"
              className={`${styles.statusButton} ${active ? styles.statusButtonActive : ''}`}
              aria-pressed={active}
              onClick={() => onStatusChange(value)}
            >
              {label}
            </button>
          )
        })}
      </div>

      <label className={styles.sortGroup}>
        排序
        <select value={sort} onChange={(e) => onSortChange(e.target.value)}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
