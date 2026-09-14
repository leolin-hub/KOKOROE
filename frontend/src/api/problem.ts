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
 */
export function toFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {}

  const result: Record<string, string> = {}
  for (const {field, message} of error.problem.errors ?? []){
    if (result[field] === undefined) {
      result[field] = message
    }
  }
  return result
}

/**
 * 取出適合直接顯示給使用者的錯誤訊息。
 */
export function toUserMessage(error: unknown): string {
  if (error instanceof ApiError) return error.problem.detail

  if (error instanceof TypeError) return '無法連線到伺服器，請檢查網路連線'

  return '發生未知錯誤，請稍後再試'
}
