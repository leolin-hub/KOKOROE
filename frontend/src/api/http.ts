import { ApiError } from './problem'
import type { ProblemDetail } from './problem'

/**
 * 極薄的 fetch 封裝。整個專案只有這裡碰 `fetch`。
 *
 * 為什麼不裝 axios：原生 fetch 已經夠用，而這層要做的事
 * （帶 base URL、設 Content-Type、把非 2xx 轉成 ApiError、處理 204）
 * 加起來不到 40 行。少一個依賴，就少一組要跟著升級的 breaking change。
 */

/**
 * API base path。走 Vite dev proxy 時是 `/api/v1`（見 vite.config.ts）。
 *
 * `??` 的兜底是給「忘記複製 .env」的情況 —— 少一個開場就卡住的理由。
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

/**
 * 發一個請求，回傳解析後的 JSON。
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`

  const headers = new Headers(init?.headers)
  if (!headers.has('Accept')){
    headers.set('Accept', 'application/json, application/problem+json')
  }
  if (init?.body && !headers.has('Content-Type')){
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(url, {...init, headers})
  // Not 2xx: Change to ApiError and throw
  if (!res.ok){
    let problem: ProblemDetail
    try {
      problem = (await res.json()) as ProblemDetail
    }
    catch{
      // The res is not json
      problem = {
        type: 'about:blank',
        title: res.statusText || '請求失敗',
        status:res.status,
        detail: '伺服器暫時無法處理請求，請稍後再試',
      }
    }
    throw new ApiError(problem)
  }

  // 204 No content: No body, can't call res.json()
  // Use http.delete
  if (res.status === 204) {
    return undefined as T
  }

  return (await res.json()) as T

}

/**
 * 把查詢參數物件轉成 query string。
 */
function toQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)){
    if (value === undefined || value === null || value === ''){
      continue
    }
    search.append(key, String(value))
  }

  const qs = search.toString()
  return qs !== '' ? `?${qs}` : ''
}

/**
 * 對外的 HTTP 介面。
 *
 * 用一個物件收斂而非散裝 export：呼叫端寫 `http.get(...)` 一眼就知道這是網路操作，
 * 比 `get(...)` 這種容易跟 lodash 之類撞名的裸函式清楚。
 */
export const http = {
  get: <T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> =>
    request<T>(params ? `${path}${toQueryString(params)}` : path),

  post: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  put: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),

  delete: (path: string): Promise<void> => request<void>(path, { method: 'DELETE' }),
}

/**
 * 順手 re-export，讓需要判斷錯誤型別的地方只 import 一個模組。
 * 例如：`import { http, ApiError } from '../api/http'`
 */
export { ApiError }
export type { ProblemDetail }
