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
 * 單一欄位的錯誤訊息。
 *
 * TODO(你來寫)：
 *
 * 1. 沒有 message 時回 `null`。
 *    ⚠️ 不要回一個空的 `<p>` 然後用 CSS 藏起來 ——
 *    螢幕閱讀器仍可能讀到它，而且版面會有莫名的空隙。
 *
 * 2. 有 message 時：
 *    ```tsx
 *    return (
 *      <p id={`${fieldId}-error`} className={styles.error} role="alert">
 *        {message}
 *      </p>
 *    )
 *    ```
 *
 * 三個細節值得知道為什麼：
 *
 * - `id={`${fieldId}-error`}`：輸入框那邊要寫
 *   `aria-describedby={error ? `${fieldId}-error` : undefined}`，
 *   兩邊的 id 必須對得起來。這個命名規則請保持一致。
 *
 * - `role="alert"`：讓螢幕閱讀器在訊息出現時**立即朗讀**，
 *   而不是等使用者自己 tab 過去才發現。送出表單後跳出的錯誤需要這個。
 *
 * - 顏色不能是唯一的訊號。紅字對色盲使用者可能與一般文字無異，
 *   所以訊息本身要講清楚問題（後端的中文訊息已經做到了），
 *   CSS 裡也建議加一個 `⚠` 之類的符號或左邊框。
 */
export default function FieldError({ message, fieldId }: FieldErrorProps) {
  throw new Error(`TODO: 實作 FieldError（${fieldId}: ${message ?? '無錯誤'}）`)
}
