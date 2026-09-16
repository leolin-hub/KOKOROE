import { http } from './http'
import type { CameraResponse, CreateCameraRequest, UpdateCameraRequest } from '../types/camera'
import type { PageResponse } from '../types/filmRoll'

/**
 * 相機 API 的呼叫函式，一支對應一個 endpoint。和 `filmRolls.ts` 一樣不含任何 React。
 */

const RESOURCE = '/cameras'

/**
 * 列出相機。後端預設每頁 100 筆（也是上限），並依品牌、型號排序，
 * 個人的相機數量一頁就放得下，所以這裡不處理分頁。
 */
export function listCameras(): Promise<PageResponse<CameraResponse>> {
  return http.get<PageResponse<CameraResponse>>(RESOURCE)
}

/** 取單一相機。 */
export function getCamera(id: number): Promise<CameraResponse> {
  return http.get<CameraResponse>(`${RESOURCE}/${id}`)
}

/** 新增相機。同名已存在時 409。 */
export function createCamera(body: CreateCameraRequest): Promise<CameraResponse> {
  return http.post<CameraResponse>(RESOURCE, body)
}

/** 更新相機（整份取代）。同名、或改片幅會讓使用中的卷期不相容時 409。 */
export function updateCamera(id: number, body: UpdateCameraRequest): Promise<CameraResponse> {
  return http.put<CameraResponse>(`${RESOURCE}/${id}`, body)
}

/** 刪除相機。還有卷期使用時 409。 */
export function deleteCamera(id: number): Promise<void> {
  return http.delete(`${RESOURCE}/${id}`)
}
