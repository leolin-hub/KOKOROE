/**
 * RFC 9457 `application/problem+json` 的前端對應。
 *
 * 後端所有錯誤都走這個格式（見 common/GlobalExceptionHandler），
 * 所以前端只要認得這一種錯誤形狀，就能處理全部的失敗情境。
 */

/** 後端可能回傳的 problem type URN。 */
export type ProblemType =
  | 'urn:kokoroe:problem:validation-failed'
  | 'urn:kokoroe:problem:business-rule-violated'
  | 'urn:kokoroe:problem:malformed-request'
  | 'urn:kokoroe:problem:resource-not-found'
  | 'urn:kokoroe:problem:internal-error'

/** 驗證失敗時 `errors` 陣列的單一元素，可直接對應到表單欄位。 */
export interface FieldError {
  /** 對應請求 DTO 的欄位名，例如 `"filmName"`、`"iso"` */
  field: string
  /** 後端寫好的中文訊息，例如 `"底片名稱不可為空"`，可直接顯示給使用者 */
  message: string
}

/**
 * problem+json 的 body。
 *
 * `type` 用 `ProblemType | string` 而非只有聯集：後端未來新增錯誤類型時，
 * 前端不該因為多了一個沒見過的 URN 就在型別層爆掉。
 * 聯集的價值在於自動完成與 `switch` 的提示，不在於封死可能性。
 */
export interface ProblemDetail {
  type: ProblemType | string
  title: string
  status: number
  detail: string
  /** ISO-8601 instant */
  timestamp?: string
  /** 只有 400 validation-failed 會帶 */
  errors?: FieldError[]
}

/**
 * 所有非 2xx 回應都會被包成這個錯誤丟出。
 *
 * 為什麼要自訂 Error 而不是直接 `throw problem`：
 * TanStack Query、error boundary、`console.error` 都預期拿到 Error 實例
 * （才有 stack trace、才有 `instanceof` 可判斷）。丟裸物件會讓這些機制失效。
 */
export class ApiError extends Error {
  readonly status: number
  readonly problem: ProblemDetail

  constructor(problem: ProblemDetail) {
    // Error 的 message 給開發者看（console / log），problem.detail 給使用者看。
    super(`${problem.status} ${problem.title}: ${problem.detail}`)
    this.name = 'ApiError'
    this.status = problem.status
    this.problem = problem
  }

  /** 這個錯誤是否帶有可對應到表單欄位的驗證訊息。 */
  get hasFieldErrors(): boolean {
    return Boolean(this.problem.errors?.length)
  }
}

/**
 * 把 `ApiError` 的 `errors` 陣列轉成「欄位名 → 訊息」的物件，
 * 方便表單直接用 `fieldErrors.filmName` 取用。
 *
 * TODO(你來寫)：
 * 1. 若 `error` 不是 `ApiError`（可能是網路錯誤、TypeError），回空物件 `{}`。
 *    提示：`if (!(error instanceof ApiError)) return {}`
 * 2. 遍歷 `error.problem.errors`，累積成 `Record<string, string>`。
 *    可以用 `reduce`，或 `Object.fromEntries(errors.map(e => [e.field, e.message]))`。
 * 3. 想一下：同一個欄位可能有多個錯誤（例如 iso 同時違反 @Positive 與 @Max）嗎？
 *    若會，你要「留第一個」還是「後者覆蓋前者」？Object.fromEntries 是後者覆蓋。
 *    先選一個並在這裡註明你的決定。
 *
 * @param error unknown —— 刻意不收 `ApiError`，因為 catch 到的東西型別本來就是 unknown，
 *              把 narrowing 的責任收在這個函式裡，呼叫端才不用每次都判斷一次。
 */
export function toFieldErrors(error: unknown): Record<string, string> {
  throw new Error(`TODO: 實作 toFieldErrors（收到 ${typeof error}）`)
}

/**
 * 取出適合直接顯示給使用者的錯誤訊息。
 *
 * TODO(你來寫)：
 * 1. `ApiError` → 回 `error.problem.detail`（後端已經寫成使用者看得懂的中文）。
 * 2. 一般 `Error`（例如 fetch 失敗、離線）→ 回一句自己的文案，
 *    例如「無法連線到伺服器，請確認後端是否啟動」。
 *    不要直接把 `error.message` 丟出去，那通常是 "Failed to fetch" 這種對使用者無意義的字。
 * 3. 其他 unknown → 回一句通用兜底訊息。
 */
export function toUserMessage(error: unknown): string {
  throw new Error(`TODO: 實作 toUserMessage（收到 ${typeof error}）`)
}
