import styles from './FieldError.module.css'

interface FieldErrorProps {
  /** 錯誤訊息。`undefined` 代表這個欄位目前沒有錯誤。 */
  message?: string
  /**
   * 這則錯誤所屬的欄位 id，用來組 `aria-describedby`。
   *
   * 為什麼需要它：視覺正常的使用者看得到紅字就在輸入框下方，
   * 但螢幕閱讀器需要明確的關聯才知道「這句話是在講哪個欄位」。
   * 這個關聯要靠 id 建立，光是 DOM 上相鄰沒有用。
   */
  fieldId: string
}

/**
 * 單一欄位下方的紅字錯誤訊息。
 *
 * 【影響畫面】
 *   新增頁、編輯頁的表單。例如送出後後端回「底片名稱不可為空」，
 *   這句話會出現在「底片名稱」輸入框正下方；沒有錯誤時什麼都不顯示。
 *   由 FilmRollForm 在每個欄位下面放一個：
 *   `<FieldError fieldId="filmName" message={fieldErrors.filmName} />`
 *
 * 【會用到】只有 JSX 與 `styles.error`（FieldError.module.css），不需要任何 hook。
 *
 * 【步驟】
 * 1. `if (!message) return null`
 *    不要回一個空的 `<p>` 再用 CSS 藏起來：螢幕閱讀器可能還是會讀到，版面也會多一塊空白。
 *
 * 2. 有訊息時回傳：
 *    ```tsx
 *    return (
 *      <p id={`${fieldId}-error`} className={styles.error} role="alert">
 *        {message}
 *      </p>
 *    )
 *    ```
 *
 * 【為什麼要這三個屬性】
 * - `id={`${fieldId}-error`}`：表單的輸入框會寫 `aria-describedby="filmName-error"` 指向這裡，
 *   螢幕閱讀器才知道這句錯誤在講哪個欄位。兩邊的命名規則（`欄位名-error`）必須一致。
 * - `role="alert"`：訊息一出現就朗讀，不用等使用者自己移到這裡才發現。
 * - `className={styles.error}`：記得在 FieldError.module.css 的 `.error::before` 加一個 `⚠`，
 *   讓錯誤不只靠紅色傳達，色盲使用者也看得出來。
 */
export default function FieldError({ message, fieldId }: FieldErrorProps) {
  if (!message) return null
  return (
    <p id={`${fieldId}-error`} className={styles.error} role="alert"
    >
      {message}
    </p>
  )
}
