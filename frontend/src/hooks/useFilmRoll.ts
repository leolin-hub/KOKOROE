import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { getFilmRoll } from '../api/filmRolls'
import { filmRollKeys } from './queryKeys'
import type { FilmRollResponse } from '../types/filmRoll'

/**
 * 讀取單一卷期。
 *
 * `enabled` 是這支 hook 的重點。路由參數是從 URL 來的字串，
 * `/film-rolls/abc` 會讓 `Number('abc')` 變成 `NaN`。
 * 如果照樣發請求，你會打到 `/film-rolls/NaN` 然後拿到一個 400。
 *
 * Hook 不能有條件地呼叫（React 的規則），所以「不要抓」的表達方式
 * 是照樣呼叫 useQuery、但用 `enabled: false` 讓它不執行 queryFn。
 * 提示：`enabled: Number.isInteger(id) && id > 0`
 *
 * 注意 `enabled: false` 時，`status` 會是 `'pending'` 但 `fetchStatus` 是 `'idle'`。
 * 也就是 `isPending` 為 true 卻永遠不會有結果 —— 若 UI 只看 `isPending`
 * 就會卡在 loading 轉圈圈。呼叫端要嘛先擋掉無效 id，
 * 要嘛用 `isLoading`（它是 `isPending && isFetching`，正確反映「真的在等」）。
 *
 * @param id 卷期 id。允許收到 NaN —— 由這支 hook 負責擋，而不是要求每個呼叫端自己檢查。
 * @param options.enabled 呼叫端要暫停查詢時傳 false。
 *   詳情頁在刪除成功後用它：跳回列表前頁面還會再 render 一次，
 *   這時快取已被移除，不暫停的話會重抓一次、拿到 404。
 */
export function useFilmRoll(
  id: number,
  options: { enabled?: boolean } = {},
): UseQueryResult<FilmRollResponse, Error> {
  return useQuery({
    queryKey: filmRollKeys.detail(id),
    queryFn: () => getFilmRoll(id),
    enabled: (options.enabled ?? true) && Number.isInteger(id) && id > 0,
  })
}
