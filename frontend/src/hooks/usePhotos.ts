import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { listPhotos } from '../api/photos'
import { photoKeys } from './queryKeys'
import type { PhotoResponse } from '../types/photo'

/**
 * 某一卷的所有照片（依格號排序）。
 *
 * `enabled` 的理由同 `useFilmRoll`：網址的 id 可能是 NaN，不合法時不發請求。
 */
export function usePhotos(rollId: number): UseQueryResult<PhotoResponse[], Error> {
  return useQuery({
    queryKey: photoKeys.byRoll(rollId),
    queryFn: () => listPhotos(rollId),
    enabled: Number.isInteger(rollId) && rollId > 0,
  })
}
