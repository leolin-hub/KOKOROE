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
 *
 * TODO(你來寫)：這支是後面所有 API 函式的地基，建議第一個實作。
 *
 * 1. 組 URL：`${BASE_URL}${path}`。path 請一律以 `/` 開頭。
 *
 * 2. 呼叫 `fetch(url, { ...init, headers })`。
 *    headers 要合併 `init?.headers` 與你自己的預設值，別直接覆蓋掉呼叫端傳的。
 *    只有在「有 body」時才需要設 `'Content-Type': 'application/json'`
 *    —— GET 帶著 Content-Type 沒有意義，某些 proxy 還會因此觸發 preflight。
 *    另外可以帶 `'Accept': 'application/json, application/problem+json'`，
 *    明確告訴後端「錯誤我也要 JSON」。
 *
 * 3. 處理 `204 No Content`（DELETE 會回這個）：
 *    這種回應**沒有 body**，對它呼叫 `res.json()` 會丟 SyntaxError。
 *    要先判斷 `res.status === 204` 就直接 return。
 *    但 return 什麼？函式簽章說回 `T`，而 204 沒有值可回。
 *    這是這支函式最尷尬的一點 —— 兩種常見解法：
 *      (a) `return undefined as T`，由呼叫端用 `request<void>(...)` 自我約束；
 *      (b) 另外開一支 `requestNoContent()` 回 `Promise<void>`。
 *    (a) 比較省，(b) 型別比較誠實。挑一個，並在這裡寫下你為什麼這樣選。
 *
 * 4. 非 2xx（`!res.ok`）：讀出 problem+json 並 `throw new ApiError(problem)`。
 *    ⚠️ 這裡有個陷阱：錯誤回應**不一定**是 JSON。
 *    如果後端掛了、或 proxy 回一頁 HTML 502，`res.json()` 會自己丟 SyntaxError，
 *    你的 ApiError 就永遠不會被丟出，呼叫端拿到的是一個完全看不懂的錯誤。
 *    所以請用 try/catch 包住解析，失敗時自己組一個 ProblemDetail 兜底
 *    （status 用 `res.status`，title 用 `res.statusText`）。
 *
 * 5. 2xx：`return (await res.json()) as T`。
 *    注意這個 `as` 是一個**未經驗證的承諾** —— TypeScript 只是相信你，
 *    runtime 並沒有真的檢查後端回的東西長不長這樣。
 *    這個專案規模可以接受；若哪天契約開始變動頻繁，這裡就是塞 zod 驗證的地方。
 *
 * @param path 以 `/` 開頭的路徑，例如 `/film-rolls/1`
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  throw new Error(`TODO: 實作 request（${init?.method ?? 'GET'} ${path}）`)
}

/**
 * 把查詢參數物件轉成 query string。
 *
 * TODO(你來寫)：
 * 1. 用 `URLSearchParams` 累積。
 * 2. **跳過值為 `undefined`、`null` 或空字串的鍵** —— 這是重點。
 *    若沒跳過，`status: undefined` 會變成 `?status=undefined` 這個字串，
 *    後端會拿它去比對 enum，然後回你一個 400 參數型別錯誤。
 *    「不篩選」的正確表達是「不要帶這個參數」，不是「帶一個空值」。
 * 3. 回傳時記得處理前綴：有參數才回 `?a=1&b=2`，沒有就回空字串 `''`。
 *    直接回 `?` 會讓 URL 變成 `/film-rolls?`，雖然多數後端能容忍，但很醜。
 */
function toQueryString(params: Record<string, string | number | undefined>): string {
  throw new Error(`TODO: 實作 toQueryString（收到 ${Object.keys(params).length} 個鍵）`)
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
