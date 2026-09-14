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
 * `error` 為 falsy 時回 `null`，呼叫端可以無條件 render 它。
 * 顯示文字一律走 `toUserMessage`：`error.message` 是給開發者看的，
 * 網路失敗時只會是 "Failed to fetch"。
 */
export default function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  if (!error) return null

  // 只有 5xx 與網路錯誤值得重試；4xx 重試一百次結果都一樣。
  const canRetry = !(error instanceof ApiError) || error.status >= 500

  return (
    <div className={styles.banner} role="alert">
      <p className={styles.message}>{toUserMessage(error)}</p>
      {import.meta.env.DEV && error instanceof ApiError && (
        <code className={styles.debugType}>{error.problem.type}</code>
      )}
      {onRetry && canRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          重試
        </button>
      )}
    </div>
  )
}
