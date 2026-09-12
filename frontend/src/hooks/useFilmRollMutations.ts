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
 * 寫入操作（新增 / 更新 / 刪除）。
 *
 * 三支分開 export 而不是包成一個大 hook：
 * 新增頁只需要 create，詳情頁只需要 update + delete。
 * 綁在一起會讓每個頁面都訂閱到用不到的 mutation 狀態。
 *
 * ── 共通課題：寫入成功後，怎麼讓畫面上的舊資料更新？──
 *
 * TanStack Query **不會**自己知道「你剛剛 POST 的東西影響了哪些 query」。
 * 這件事必須你明確告訴它，有兩種手段：
 *
 * (a) `queryClient.invalidateQueries({ queryKey })`
 *     把符合前綴的快取標記為過期，畫面上正在用的會自動重抓。
 *     最簡單、最不會錯，代價是多一趟網路來回。**先用這個。**
 *
 * (b) `queryClient.setQueryData(queryKey, newData)`
 *     直接把新資料寫進快取，不重抓。快，但你得自己保證寫進去的形狀
 *     跟後端會回的一模一樣 —— 例如後端算出來的 `updatedAt`，你猜不到。
 *     猜錯就會出現「畫面顯示的跟資料庫不一致」，而且不會有任何錯誤訊息。
 *
 * 新手常見的錯誤是一上手就追求 (b) 的「樂觀更新」，結果花大量時間 debug
 * 快取與真實資料的不一致。(a) 在這個規模下完全夠用。
 */

/**
 * 新增卷期。
 *
 * TODO(你來寫)：
 *
 * ```ts
 * const queryClient = useQueryClient()
 * return useMutation({
 *   mutationFn: createFilmRoll,
 *   onSuccess: (created) => {
 *     // 1. 所有列表都可能因為多了一筆而改變 → 失效 filmRollKeys.lists()
 *     // 2. 順手把新資料塞進 detail 快取，這樣馬上跳轉到詳情頁就不用再抓一次：
 *     //    queryClient.setQueryData(filmRollKeys.detail(created.id), created)
 *     //    （這裡用 setQueryData 是安全的 —— 資料是後端剛回的，不是你猜的）
 *   },
 * })
 * ```
 *
 * 注意 `onSuccess` 要不要 `return` 那個 Promise：
 * `invalidateQueries` 回傳 Promise。若你 `await` 它，mutation 的 `isPending`
 * 會一直到重抓完成才變 false（按鈕的 loading 狀態會涵蓋重抓）。
 * 不 await 則按鈕先恢復、列表稍後才更新。兩種體驗都合理，自己選一個。
 */
export function useCreateFilmRoll(): UseMutationResult<
  FilmRollResponse,
  Error,
  CreateFilmRollRequest
> {
  throw new Error('TODO: 實作 useCreateFilmRoll')
}

/**
 * 更新卷期。
 *
 * TODO(你來寫)：
 *
 * mutationFn 只吃**一個**參數，但 update 需要 id 和 body 兩個。
 * 標準做法是把它們包成一個物件：
 *
 * ```ts
 * mutationFn: ({ id, body }: UpdateFilmRollVariables) => updateFilmRoll(id, body),
 * ```
 *
 * onSuccess 要失效兩處：
 *   - `filmRollKeys.detail(id)` —— 這一筆變了
 *   - `filmRollKeys.lists()` —— 列表上顯示的內容（狀態、名稱）也變了
 *
 * 想一下：如果只失效 detail 會發生什麼？
 * （提示：改完狀態按返回，列表上那張卡片還是舊的 badge）
 *
 * 呼叫端會拿到什麼錯誤：
 *   - 400 → 欄位或跨欄位規則錯，用 `toFieldErrors` 攤回表單
 *   - 409 → 狀態逆向流轉，這不是欄位錯，要用整體訊息呈現
 *   - 404 → 這筆在你編輯時被刪了，該把人導回列表
 */
export interface UpdateFilmRollVariables {
  id: number
  body: UpdateFilmRollRequest
}

export function useUpdateFilmRoll(): UseMutationResult<
  FilmRollResponse,
  Error,
  UpdateFilmRollVariables
> {
  throw new Error('TODO: 實作 useUpdateFilmRoll')
}

/**
 * 刪除卷期。
 *
 * TODO(你來寫)：
 *
 * ```ts
 * mutationFn: deleteFilmRoll,
 * onSuccess: (_data, id) => {
 *   // 第二個參數是當初傳給 mutate() 的 variables，這裡就是 id。
 *   // 刪除後 detail 快取該整個移除而非失效：
 *   //   queryClient.removeQueries({ queryKey: filmRollKeys.detail(id) })
 *   // 用 invalidate 的話，那個 key 還在快取裡、且被標記為過期，
 *   // 若還有元件掛在上面就會立刻重抓 → 拿到 404。
 *   // 已經不存在的東西，要的是「忘掉」，不是「重新確認」。
 *   // 然後失效 lists()。
 * },
 * ```
 */
export function useDeleteFilmRoll(): UseMutationResult<void, Error, number> {
  throw new Error('TODO: 實作 useDeleteFilmRoll')
}
