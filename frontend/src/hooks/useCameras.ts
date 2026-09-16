import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { listCameras } from '../api/cameras'
import { cameraKeys } from './queryKeys'
import type { CameraResponse } from '../types/camera'

/**
 * 讀取全部相機。
 *
 * 【影響畫面】新增頁、編輯頁表單裡的「相機」下拉選單。
 *
 * - `select` 只取出 `content`：呼叫端要的是相機陣列，不需要分頁資訊。
 *   快取裡存的仍是完整回應，`select` 只影響這個 hook 回傳的 `data`。
 * - `staleTime` 設 5 分鐘：相機很少變動，在新增頁與編輯頁之間切換時不必每次重抓。
 *   之後做相機管理頁時，新增 / 修改相機成功後要 invalidate `cameraKeys.lists()`。
 */
export function useCameras(): UseQueryResult<CameraResponse[], Error> {
  return useQuery({
    queryKey: cameraKeys.lists(),
    queryFn: listCameras,
    select: (page) => page.content,
    staleTime: 5 * 60 * 1000,
  })
}
