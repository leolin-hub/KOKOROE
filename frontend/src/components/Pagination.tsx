import type { PageResponse } from '../types/filmRoll'
import styles from './Pagination.module.css'

interface PaginationProps {
  /**
   * 直接收整個分頁結果，而不是把 page / totalPages / first / last
   * 拆成四個 props。
   *
   * 理由：這四個值永遠是一起來的、且必須互相一致。
   * 拆開傳，呼叫端就有機會傳出 `page: 3, totalPages: 2` 這種不可能的組合。
   * 讓型別只允許有效的狀態，是最省力的防呆。
   *
   * 用 `Pick` 而非整個 `PageResponse<T>`：這個元件不需要 `content`，
   * 也不該因為 content 的型別參數而變成 generic。
   */
  page: Pick<PageResponse<unknown>, 'page' | 'totalPages' | 'totalElements' | 'first' | 'last'>
  onPageChange: (page: number) => void
  /** 翻頁請求進行中時為 true，用來停用按鈕避免連點。 */
  isLoading?: boolean
}

/**
 * 分頁控制（上一頁／下一頁）。
 *
 * - 進出 API 一律 0-based，只有 JSX 裡顯示給人看時才 `+ 1`。
 * - 能不能翻頁看後端算好的 `first` / `last`，不自己用 page 與 totalPages 推算。
 * - 只有一頁（或沒有資料）時分頁控制沒有用途，直接不顯示。
 * - `<nav>` 帶 `aria-label`，和頁面上其他導覽區分開。
 */
export default function Pagination({ page, onPageChange, isLoading }: PaginationProps) {
  if (page.totalPages <= 1) return null

  return (
    <nav className={styles.pagination} aria-label="分頁導覽">
      <button
        type="button"
        className={styles.button}
        onClick={() => onPageChange(page.page - 1)}
        disabled={page.first || isLoading}
      >
        上一頁
      </button>
      <span className={styles.info}>
        第 {page.page + 1} / {page.totalPages} 頁（共 {page.totalElements} 卷）
      </span>
      <button
        type="button"
        className={styles.button}
        onClick={() => onPageChange(page.page + 1)}
        disabled={page.last || isLoading}
      >
        下一頁
      </button>
    </nav>
  )
}
