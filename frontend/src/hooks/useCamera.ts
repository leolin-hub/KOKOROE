import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { getCamera } from '../api/cameras'
import { cameraKeys } from './queryKeys'
import type { CameraResponse } from '../types/camera'

/**
 * 讀取單一相機。
 *
 * 【影響畫面】相機編輯頁（/cameras/:id/edit）。
 *
 * `enabled` 的用法與 `useFilmRoll` 相同：網址的 id 不合法時不發請求，
 * 刪除成功、跳頁前的那次 render 由呼叫端傳 `enabled: false` 暫停，避免重抓拿到 404。
 */
export function useCamera(
  id: number,
  options: { enabled?: boolean } = {},
): UseQueryResult<CameraResponse, Error> {
  return useQuery({
    queryKey: cameraKeys.detail(id),
    queryFn: () => getCamera(id),
    enabled: (options.enabled ?? true) && Number.isInteger(id) && id > 0,
  })
}
