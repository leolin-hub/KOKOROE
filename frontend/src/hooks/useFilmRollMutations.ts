import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { createFilmRoll, deleteFilmRoll, updateFilmRoll } from '../api/filmRolls'
import { filmRollKeys } from './queryKeys'
import type {
  CreateFilmRollRequest,
  FilmRollResponse,
  UpdateFilmRollRequest,
} from '../types/filmRoll'

/**
 * 寫入操作（新增 / 更新 / 刪除）的三支 hook。
 *
 * ── 在網站上的位置 ──
 *
 *   useCreateFilmRoll → 「裝新的一卷」頁（/film-rolls/new）按下「建立卷期」
 *   useUpdateFilmRoll → 詳情頁的「推進狀態」按鈕、編輯頁按下「儲存變更」
 *   useDeleteFilmRoll → 詳情頁的「刪除」按鈕
 *
 * 這三支本身不畫任何畫面，只負責「送出請求」與「成功後讓畫面上的舊資料更新」。
 * 寫完這個檔案畫面不會有變化，要等頁面接上才看得到效果。
 *
 * ── 共通觀念：寫入成功後，列表為什麼會自動更新？──
 *
 * TanStack Query 不知道你的 POST / PUT / DELETE 影響了哪些資料，
 * 要在 `onSuccess` 裡用 queryClient 明確告訴它：
 *
 *   queryClient.invalidateQueries({ queryKey })  標記過期 → 畫面上正在用的會自動重抓（最常用）
 *   queryClient.setQueryData(queryKey, data)     直接寫進快取、不重抓（只用在「資料是後端剛回傳的」時候）
 *   queryClient.removeQueries({ queryKey })      把快取整個刪掉（刪除資料時用）
 *
 * 會用到的 key 都在 `hooks/queryKeys.ts`：
 *
 *   filmRollKeys.lists()     所有列表（列表頁用的那些，不分篩選條件）
 *   filmRollKeys.detail(id)  某一卷的詳情（詳情頁、編輯頁用的）
 *
 * 三支 hook 的骨架都一樣：
 *
 * ```ts
 * const queryClient = useQueryClient()
 * return useMutation({
 *   mutationFn: ...,                          // 真正打 API 的函式（從 api/filmRolls.ts 來）
 *   onSuccess: (data, variables) => { ... },  // data = 後端回傳的內容；variables = 呼叫 mutate() 時傳的參數
 * })
 * ```
 */

/**
 * 新增一卷。
 *
 * 【影響畫面】
 *   新增頁按下「建立卷期」→ 成功後跳到新卷期的詳情頁；
 *   回到列表時會看到多了一張卡片。
 *
 * 【會用到】（全部已 import）
 *   - useQueryClient()、useMutation()        @tanstack/react-query
 *   - createFilmRoll(body)                   api/filmRolls.ts
 *   - filmRollKeys.lists()、filmRollKeys.detail(id)
 *
 * 【步驟】
 * 1. `const queryClient = useQueryClient()`
 * 2. `return useMutation({ mutationFn: createFilmRoll, onSuccess: (created) => { ... } })`
 *    `createFilmRoll` 剛好只收一個參數（body），可以直接傳，不用再包一層箭頭函式。
 * 3. onSuccess 收到的 `created` 是後端建好的那一卷，做兩件事：
 *    a. `queryClient.invalidateQueries({ queryKey: filmRollKeys.lists() })`
 *       → 列表多了一筆，所有列表的快取都要重抓
 *    b. `queryClient.setQueryData(filmRollKeys.detail(created.id), created)`
 *       → 新增成功後頁面會跳到詳情頁，先把資料放進快取，詳情頁就不用再等一次載入。
 *         這裡可以用 setQueryData，是因為資料是後端剛回傳的，不是自己猜的。
 *
 * 【可以想一下】onSuccess 裡要不要寫 `return queryClient.invalidateQueries(...)`？
 *   有 return：按鈕的「儲存中…」會持續到列表重抓完才結束。
 *   沒 return：按鈕先恢復，列表稍後才更新。兩種都可以，自己選一種。
 */
export function useCreateFilmRoll(): UseMutationResult<
  FilmRollResponse,
  Error,
  CreateFilmRollRequest
> {
  throw new Error('TODO: 實作 useCreateFilmRoll')
}

/** `useUpdateFilmRoll` 的 `mutate()` 參數：要更新哪一卷（id）、更新成什麼（body）。 */
export interface UpdateFilmRollVariables {
  id: number
  body: UpdateFilmRollRequest
}

/**
 * 更新一卷（PUT，整份取代）。
 *
 * 【影響畫面】
 *   - 詳情頁按「推進到：沖洗中」這類按鈕 → 狀態 badge 馬上改變
 *   - 編輯頁按「儲存變更」→ 跳回詳情頁看到新內容
 *   回到列表時，卡片上的名稱、狀態也要是新的。
 *
 * 【會用到】（全部已 import）
 *   - useQueryClient()、useMutation()
 *   - updateFilmRoll(id, body)               api/filmRolls.ts
 *   - filmRollKeys.detail(id)、filmRollKeys.lists()
 *
 * 【步驟】
 * 1. `const queryClient = useQueryClient()`
 * 2. mutationFn 只能收「一個」參數，但 updateFilmRoll 要 id 和 body 兩個。
 *    所以呼叫端傳一個 `{ id, body }` 物件（型別就是上面的 UpdateFilmRollVariables），這裡再拆開：
 *    `mutationFn: ({ id, body }: UpdateFilmRollVariables) => updateFilmRoll(id, body)`
 * 3. onSuccess 的第二個參數就是呼叫端傳的 `{ id, body }`，拿 id 去失效兩處：
 *    `onSuccess: (_updated, { id }) => { ... }`
 *    a. `queryClient.invalidateQueries({ queryKey: filmRollKeys.detail(id) })`  → 詳情頁顯示的這一卷
 *    b. `queryClient.invalidateQueries({ queryKey: filmRollKeys.lists() })`     → 列表卡片上的名稱、狀態
 *    只寫 a 的話：推進狀態後按「回到列表」，卡片上還是舊的 badge。
 *
 * 【呼叫端會收到的錯誤】（這支 hook 不用處理，由頁面處理）
 *   400 → 欄位填錯 → 頁面用 `toFieldErrors(error)` 顯示在欄位下方
 *   409 → 狀態不能倒退（例如已歸檔改回拍攝中）→ 頁面用 ErrorBanner 顯示
 *   404 → 編輯到一半，這卷在別的分頁被刪了
 */
export function useUpdateFilmRoll(): UseMutationResult<
  FilmRollResponse,
  Error,
  UpdateFilmRollVariables
> {
  throw new Error('TODO: 實作 useUpdateFilmRoll')
}

/**
 * 刪除一卷。
 *
 * 【影響畫面】詳情頁按「刪除」→ 確認後跳回列表，那張卡片消失。
 *
 * 【會用到】（全部已 import）
 *   - useQueryClient()、useMutation()
 *   - deleteFilmRoll(id)                     api/filmRolls.ts
 *   - filmRollKeys.detail(id)、filmRollKeys.lists()
 *
 * 【步驟】
 * 1. `const queryClient = useQueryClient()`
 * 2. `mutationFn: deleteFilmRoll`（只收 id 一個參數，可以直接傳）
 * 3. `onSuccess: (_data, id) => { ... }`
 *    第一個參數是後端回傳的內容：刪除回 204 沒有內容，用不到，所以取名 `_data`。
 *    第二個參數是呼叫 `mutate(id)` 時傳的 id。
 *    a. `queryClient.removeQueries({ queryKey: filmRollKeys.detail(id) })`
 *       → 這卷已經不存在，要「刪掉快取」而不是 invalidate。
 *         用 invalidate 的話，還開著的詳情頁會立刻重抓，結果拿到 404。
 *    b. `queryClient.invalidateQueries({ queryKey: filmRollKeys.lists() })`
 *       → 列表少了一筆
 */
export function useDeleteFilmRoll(): UseMutationResult<void, Error, number> {
  throw new Error('TODO: 實作 useDeleteFilmRoll')
}
