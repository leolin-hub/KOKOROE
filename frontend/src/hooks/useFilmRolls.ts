import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { listFilmRolls } from '../api/filmRolls'
import { filmRollKeys } from './queryKeys'
import type { FilmRollListParams, FilmRollResponse, PageResponse } from '../types/filmRoll'

/**
 * 讀取卷期列表。
 *
 * TODO(你來寫)：
 *
 * ```ts
 * return useQuery({
 *   queryKey: filmRollKeys.list(params),
 *   queryFn: () => listFilmRolls(params),
 *   // ...再加下面討論的選項
 * })
 * ```
 *
 * 三個值得想清楚的選項：
 *
 * 1. `placeholderData: keepPreviousData`
 *    （要多 import：`import { keepPreviousData } from '@tanstack/react-query'`）
 *    翻頁時 key 會變，預設行為是整個列表變回 loading 狀態、畫面閃一下白。
 *    加上它，舊資料會留在畫面上直到新資料到達，翻頁就不再閃動。
 *    代價是你要用 `isPlaceholderData` 才知道「現在看到的是舊的」，
 *    通常拿它來把列表調淡或停用翻頁鈕。
 *
 * 2. `staleTime`
 *    預設 0，意思是資料一到手就算過期，於是每次元件重新掛載、視窗重新聚焦
 *    都會重抓。開發時你會在 Network 看到大量請求，那不是 bug。
 *    這種「自己一個人改的資料」設個 30 秒（`staleTime: 30_000`）很合理。
 *    想一下：設太長會有什麼後果？（提示：別人在另一個分頁改了資料）
 *
 * 3. 要不要 `retry`
 *    預設失敗會重試 3 次。對 5xx 合理，但對 400 / 404 完全是浪費 ——
 *    請求本身錯了，重試一百次也是一樣的結果，只是讓使用者多等三秒。
 *    這件事可以在這裡逐一設定，也可以在 main.tsx 的 QueryClient 設全域預設。
 *    建議走全域（那裡已經留了 TODO），這裡就不用重複。
 *
 * @param params 篩選與分頁條件。注意它會成為 query key 的一部分，
 *               所以**不要**在呼叫端每次 render 都新建一個帶隨機值的物件。
 */
export function useFilmRolls(
  params: FilmRollListParams = {},
): UseQueryResult<PageResponse<FilmRollResponse>, Error> {
  throw new Error(`TODO: 實作 useFilmRolls（${JSON.stringify(params)}）`)
}
