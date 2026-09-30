import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query'
import { useInfiniteQuery } from '@tanstack/react-query'
import type { FilmRollListParams, FilmRollResponse, PageResponse } from '../types/filmRoll'
import { listFilmRolls } from '../api/filmRolls'
import { filmRollKeys } from './queryKeys'
import { DEFAULT_PAGE_SIZE } from '../lib/constants'

/**
 * 無限捲動的卷期列表：一次抓一頁，捲到快底時再抓下一頁，全部接在一起。
 *
 * 【影響畫面】唱片櫃瀏覽頁（/crate）的整個櫃子。捲到倒數幾卷時，下一批 20 卷會自動接在後面。
 *
 * 和列表頁的 `useFilmRolls` 差在哪：
 *   useFilmRolls          一次只拿「某一頁」，換頁就換掉整份資料（有分頁按鈕）
 *   useInfiniteFilmRolls  資料是「目前為止抓過的所有頁」，`data.pages` 是一個陣列
 *
 * 【會用到】
 *   - `useInfiniteQuery`                   '@tanstack/react-query'   ← 要自己 import（值，不是 type）
 *   - `listFilmRolls(params)`               '../api/filmRolls'        ← 要自己 import
 *   - `filmRollKeys.infinite(params)`       './queryKeys'             ← 要自己 import
 *   - `DEFAULT_PAGE_SIZE`（20）              '../lib/constants'        ← 要自己 import
 *   - 回傳型別用到的 type 都已經 import 好了
 *
 * 【步驟】
 * 0. 刪掉 `void params` 與 `throw` 那兩行佔位。
 * 1. ```ts
 *    return useInfiniteQuery({
 *      queryKey: filmRollKeys.infinite(params),
 *      queryFn: ({ pageParam }) => listFilmRolls({ ...params, page: pageParam, size: DEFAULT_PAGE_SIZE }),
 *      initialPageParam: 0,
 *      getNextPageParam: (lastPage) => ...,
 *    })
 *    ```
 * 2. `getNextPageParam` 是這支 hook 的核心：收到「最後抓到的那一頁」，回傳「下一頁的頁碼」。
 *    回傳 `undefined` 代表沒有下一頁了 —— TanStack Query 會據此把 `hasNextPage` 設成 false。
 *    後端的 `PageResponse` 有 `last`（是不是最後一頁）與 `page`（0-based 頁碼），用這兩個就能寫出來。
 *
 * 【坑】
 * - `initialPageParam` 在 v5 是必填的；少了它 TypeScript 會報一長串看不懂的型別錯誤。
 * - 不要加 `placeholderData: keepPreviousData`（列表頁有加）：換篩選條件時，
 *   舊條件的整串卷期會暫時留在櫃子裡，看起來像篩選沒作用。唱片櫃換條件時直接顯示「載入中」比較誠實。
 * - key 裡不能放 page：頁碼由 useInfiniteQuery 自己管理；放了的話每抓一頁就變成一份新快取。
 *   `filmRollKeys.infinite` 的參數型別已經用 `Omit<..., 'page'>` 擋掉了。
 *
 * 【可以想一下】快取過期重抓時，infinite query 會「從第 0 頁開始依序重抓已經載入過的每一頁」，
 *   不是只抓最後一頁。捲了 5 頁之後回到這個畫面，Network 面板會看到 5 個請求 —— 這是正常的。
 */
export function useInfiniteFilmRolls(
  params: Omit<FilmRollListParams, 'page'>,
): UseInfiniteQueryResult<InfiniteData<PageResponse<FilmRollResponse>, number>, Error> {
  return useInfiniteQuery({
    queryKey: filmRollKeys.infinite(params),
    queryFn: ({ pageParam }) => listFilmRolls({ ...params, page: pageParam, size: DEFAULT_PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.last ? undefined : lastPage.page + 1),
  })
}
