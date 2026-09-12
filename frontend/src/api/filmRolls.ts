import { http } from './http'
import type {
  CreateFilmRollRequest,
  FilmRollListParams,
  FilmRollResponse,
  PageResponse,
  UpdateFilmRollRequest,
} from '../types/filmRoll'

/**
 * 卷期 API 的呼叫函式，一支對應一個 endpoint。
 *
 * 這一層刻意**不含任何 React**：沒有 hook、沒有狀態、沒有快取。
 * 它只知道「怎麼跟後端講話」。快取與生命週期是下一層（hooks/）的事。
 * 這個分界讓這些函式能被單元測試直接呼叫，不需要 render 任何元件。
 */

const RESOURCE = '/film-rolls'

/**
 * 分頁列出卷期。
 *
 * TODO(你來寫)：一行就好。
 * 提示：`http.get<PageResponse<FilmRollResponse>>(RESOURCE, { ...params })`
 *
 * 想一下為什麼要展開成新物件而不是直接把 `params` 傳進去：
 * `http.get` 的第二參數型別是 `Record<string, string | number | undefined>`，
 * 而 `FilmRollListParams` 是個有具名欄位的 interface。
 * TypeScript 對「interface 指派給 index signature」是不允許的
 * （因為 interface 可能被 declaration merging 加上新欄位）。
 * 展開成物件字面值就繞過這個限制 —— 這是實務上很常遇到的一個小摩擦。
 */
export function listFilmRolls(
  params: FilmRollListParams = {},
): Promise<PageResponse<FilmRollResponse>> {
  throw new Error(`TODO: 實作 listFilmRolls（params: ${JSON.stringify(params)}）`)
}

/**
 * 取單一卷期。
 *
 * TODO(你來寫)：`http.get<FilmRollResponse>(`${RESOURCE}/${id}`)`
 * 查無資源時 http 層會丟出 status 404 的 ApiError，這裡不需要特別處理。
 */
export function getFilmRoll(id: number): Promise<FilmRollResponse> {
  throw new Error(`TODO: 實作 getFilmRoll（id: ${id}）`)
}

/**
 * 新增卷期。成功回 201，body 是建好的卷期。
 *
 * TODO(你來寫)：`http.post<FilmRollResponse>(RESOURCE, body)`
 *
 * 後端會在回應帶 `Location: /api/v1/film-rolls/{id}` header。
 * 我們的 http 層目前把 header 丟掉了 —— 這裡用不到（body 裡就有 id），
 * 但值得知道它存在，某些 API 只在 Location 給 id 而不回 body。
 */
export function createFilmRoll(body: CreateFilmRollRequest): Promise<FilmRollResponse> {
  throw new Error(`TODO: 實作 createFilmRoll（filmName: ${body.filmName}）`)
}

/**
 * 更新卷期（整份取代）。
 *
 * TODO(你來寫)：`http.put<FilmRollResponse>(`${RESOURCE}/${id}`, body)`
 *
 * ⚠️ 呼叫端要注意的兩件事（不是這支函式的責任，但錯了會在這裡炸）：
 * 1. `body` 必須是乾淨的 `UpdateFilmRollRequest`。後端開了
 *    `fail-on-unknown-properties`，混進 `id` / `createdAt` 就是 400。
 * 2. `status` 只能向前流轉。逆向會拿到 **409**，不是 400 ——
 *    因為請求本身合法，是資源目前的狀態不允許。UI 上這兩者該有不同反應：
 *    400 是「你填錯了，改一下」，409 是「這個操作對這筆資料不成立」。
 */
export function updateFilmRoll(
  id: number,
  body: UpdateFilmRollRequest,
): Promise<FilmRollResponse> {
  throw new Error(`TODO: 實作 updateFilmRoll（id: ${id}, status: ${body.status}）`)
}

/**
 * 刪除卷期。成功回 204，沒有 body。
 *
 * TODO(你來寫)：`http.delete(`${RESOURCE}/${id}`)`
 */
export function deleteFilmRoll(id: number): Promise<void> {
  throw new Error(`TODO: 實作 deleteFilmRoll（id: ${id}）`)
}
