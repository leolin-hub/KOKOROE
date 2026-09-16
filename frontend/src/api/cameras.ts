import { http } from './http'
import type { CameraResponse } from '../types/camera'
import type { PageResponse } from '../types/filmRoll'

/**
 * 相機 API 的呼叫函式。和 `filmRolls.ts` 一樣不含任何 React。
 *
 * 目前只有表單的相機下拉選單會用到，所以只寫了列表。
 * 之後做相機管理頁時，再照 `filmRolls.ts` 補上 get / create / update / delete。
 */

const RESOURCE = '/cameras'

/**
 * 列出相機。後端預設每頁 100 筆（也是上限），並依品牌、型號排序，
 * 個人的相機數量一頁就放得下，所以這裡不處理分頁。
 */
export function listCameras(): Promise<PageResponse<CameraResponse>> {
  return http.get<PageResponse<CameraResponse>>(RESOURCE)
}
