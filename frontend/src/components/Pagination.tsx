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
 * 分頁控制。
 *
 * TODO(你來寫)：
 *
 * ### 基本結構
 *
 * ```tsx
 * <nav className={styles.pagination} aria-label="分頁導覽">
 *   <button onClick={() => onPageChange(page.page - 1)} disabled={page.first || isLoading}>
 *     上一頁
 *   </button>
 *   <span>第 {page.page + 1} / {page.totalPages} 頁（共 {page.totalElements} 卷）</span>
 *   <button onClick={() => onPageChange(page.page + 1)} disabled={page.last || isLoading}>
 *     下一頁
 *   </button>
 * </nav>
 * ```
 *
 * ### 四個容易錯的地方
 *
 * **1. 0-based vs 1-based**
 *    後端的 `page` 是 0-based（第一頁是 0），但顯示給人看要 `page + 1`。
 *    這個 off-by-one 是分頁功能永恆的 bug 來源。
 *    建議在腦中定一個規則：**進出 API 一律 0-based，顯示時才 +1**，
 *    而且轉換只發生在 JSX 裡，不要在邏輯中間換基準。
 *
 * **2. 用 `first` / `last` 而不是自己算**
 *    別寫 `page.page === 0` 或 `page.page >= page.totalPages - 1`。
 *    後端已經算好 `first` / `last` 了，它才是權威。
 *    自己算的版本在「總共 0 筆」這種邊界會出錯
 *    （totalPages 是 0，`0 >= -1` 為 true，剛好對；但這是巧合，不是設計）。
 *
 * **3. `totalPages === 0` 時要不要顯示？**
 *    沒有任何資料時，顯示「第 1 / 0 頁」很奇怪。
 *    建議 `if (page.totalPages <= 1) return null` —— 只有一頁時
 *    分頁控制沒有任何用途，藏起來反而乾淨。
 *
 * **4. `<nav>` 要有 aria-label**
 *    一個頁面可能有多個 nav（頁首導覽、分頁）。
 *    沒有 label 的話，螢幕閱讀器只會說「導覽」，使用者分不出是哪個。
 *
 * 💡 做完基本版之後可以考慮加頁碼按鈕（1 2 3 … 10）。
 *    但那需要處理「頁數很多時要省略中間」的邏輯，
 *    複雜度比看起來高。上一頁/下一頁在這個規模完全夠用。
 */
export default function Pagination({ page, onPageChange, isLoading }: PaginationProps) {
  throw new Error(
    `TODO: 實作 Pagination（第 ${page.page + 1}/${page.totalPages} 頁, loading: ${Boolean(isLoading)}, onPageChange: ${typeof onPageChange}）`,
  )
}
