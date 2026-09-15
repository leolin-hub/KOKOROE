import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { listFilmRolls } from '../api/filmRolls'
import { filmRollKeys } from './queryKeys'
import type { FilmRollListParams, FilmRollResponse, PageResponse } from '../types/filmRoll'

/**
 * 讀取卷期列表（依篩選、排序、分頁條件）。
 *
 * 【影響畫面】列表頁（/film-rolls）的卡片清單與分頁。
 *
 * - `placeholderData: keepPreviousData`：翻頁或換篩選時 query key 會變，
 *   預設會整個變回 loading 而閃一下白。加上它，舊資料會留在畫面上直到新資料到達；
 *   呼叫端用 `isPlaceholderData` 判斷「目前看到的是舊資料」，列表頁拿它把清單調淡、停用翻頁鈕。
 * - 重試策略（4xx 不重試、5xx 最多 2 次）設在 main.tsx 的 QueryClient 全域預設，這裡不重複。
 *
 * @param params 篩選與分頁條件，會成為 query key 的一部分。
 *               TanStack Query 以內容比對 key，所以每次 render 新建物件沒關係，
 *               但不要放進會變的值（例如時間戳），否則每次 render 都是新的快取。
 */
export function useFilmRolls(
  params: FilmRollListParams = {},
): UseQueryResult<PageResponse<FilmRollResponse>, Error> {
  return useQuery({
    queryKey: filmRollKeys.list(params),
    queryFn: () => listFilmRolls(params),
    placeholderData: keepPreviousData,
  })
}
