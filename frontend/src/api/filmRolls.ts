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
 */
export function listFilmRolls(
  params: FilmRollListParams = {},
): Promise<PageResponse<FilmRollResponse>> {
  return http.get<PageResponse<FilmRollResponse>>(RESOURCE, {...params})
}

/**
 * 取單一卷期。
 */
export function getFilmRoll(id: number): Promise<FilmRollResponse> {
  return http.get<FilmRollResponse>(`${RESOURCE}/${id}`)
}

/**
 * 新增卷期。成功回 201，body 是建好的卷期。
 */
export function createFilmRoll(body: CreateFilmRollRequest): Promise<FilmRollResponse> {
  return http.post<FilmRollResponse>(RESOURCE, body)
}

/**
 * 更新卷期（整份取代）。
 */
export function updateFilmRoll(
  id: number,
  body: UpdateFilmRollRequest,
): Promise<FilmRollResponse> {
  return http.put<FilmRollResponse>(`${RESOURCE}/${id}`, body)
}

/**
 * 刪除卷期。成功回 204，沒有 body。
 */
export function deleteFilmRoll(id: number): Promise<void> {
  return http.delete(`${RESOURCE}/${id}`)
}
