import { ApiError, toUserMessage } from '../api/problem'
import styles from './ErrorBanner.module.css'

interface ErrorBannerProps {
  /**
   * 收 `unknown` 而不是 `Error`。
   *
   * 因為 TanStack Query 的 `error` 型別是 `Error | null`，
   * 而 catch 區塊拿到的是 `unknown`。收最寬的型別，
   * 讓 narrowing 的責任留在這個元件內部，呼叫端就永遠不用先判斷一次。
   */
  error: unknown
  /** 可選的重試動作。沒傳就不顯示重試按鈕。 */
  onRetry?: () => void
}

/**
 * 整體性錯誤的橫幅。用於「不屬於任何單一欄位」的錯誤。
 *
 * 什麼時候用這個、什麼時候用 `FieldError`：
 *
 *   400 + errors 陣列  → FieldError（指向具體欄位，使用者知道要改哪裡）
 *   400 業務規則        → ErrorBanner（跨欄位，沒有單一歸屬）
 *   409 狀態衝突        → ErrorBanner（不是填錯，是操作不成立）
 *   404 / 500 / 網路    → ErrorBanner
 *
 * TODO(你來寫)：
 *
 * 1. `error` 為 falsy 時回 `null`（讓呼叫端可以無條件 render 它）。
 *
 * 2. 用 `toUserMessage(error)` 取得顯示文字。
 *    ⚠️ 絕對不要顯示 `String(error)` 或 `error.message`：
 *    前者會印出 "Error: 500 伺服器內部錯誤: ..." 這種夾著型別名的字串，
 *    後者在網路失敗時是 "Failed to fetch" —— 對使用者毫無意義。
 *
 * 3. 決定要不要顯示重試按鈕。合理的規則：
 *    只有 5xx 與網路錯誤值得重試，4xx 不值得（重試一百次結果一樣）。
 *    提示：`const canRetry = !(error instanceof ApiError) || error.status >= 500`
 *    然後 `onRetry && canRetry` 才 render 按鈕。
 *
 * 4. 加上 `role="alert"`，理由同 FieldError。
 *
 * 5. 開發時的除錯便利（可選，但很好用）：
 *    在 `import.meta.env.DEV` 時，把 `problem.type` 也顯示出來。
 *    知道是 `validation-failed` 還是 `business-rule-violated`
 *    能省下很多翻後端程式的時間。正式環境不該顯示這種內部識別碼。
 */
export default function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  throw new Error(
    `TODO: 實作 ErrorBanner（error: ${error instanceof ApiError ? error.status : typeof error}, onRetry: ${Boolean(onRetry)}）`,
  )
}
