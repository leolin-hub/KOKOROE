import { Link, useNavigate, useParams } from 'react-router'
import { useFilmRoll } from '../hooks/useFilmRoll'
import { useUpdateFilmRoll } from '../hooks/useFilmRollMutations'
import FilmRollForm from '../components/FilmRollForm'
import ErrorBanner from '../components/ErrorBanner'
import { toFieldErrors } from '../api/problem'
import type { UpdateFilmRollRequest } from '../types/filmRoll'
import styles from './FilmRollFormPage.module.css'

/**
 * 編輯卷期頁。路由 `/film-rolls/:id/edit`。
 *
 * 與新增頁的差別在於：要先把既有資料讀出來當表單初始值。
 *
 * ══════════════════════════════════════════════════
 * TODO(你來寫)
 * ══════════════════════════════════════════════════
 *
 * ### 步驟 1：讀出目前的資料
 *
 * ```ts
 * const { id } = useParams<{ id: string }>()
 * const rollId = Number(id)
 * const { data: roll, isLoading, isError, error } = useFilmRoll(rollId)
 * ```
 *
 * ⚠️ **不要**在資料還沒到之前就 render `<FilmRollForm>`。
 *    表單的 useState 初始值只會在第一次 mount 時生效
 *    —— 之後 props 變了，state **不會**跟著更新。
 *    若你先用空值 render，資料到了畫面還是空的，
 *    而且這個 bug 看起來像「API 沒回資料」，會讓你查錯方向。
 *
 *    正確做法是在 `isLoading` 時顯示載入中，
 *    等 `roll` 真的存在了才 render 表單。
 *    這也是為什麼 `FilmRollForm` 的 `initialValues` 設計成 required ——
 *    型別逼你先處理 loading，而不是丟一個 undefined 進去。
 *
 *    （另一種解法是給 Form 加 `key={roll.id}` 強制重建，
 *    但「等資料到了再 render」更直白，也不需要理解 key 的重建語意。）
 *
 * ### 步驟 2：轉成表單初始值
 *
 * `FilmRollResponse` 不能直接當 `UpdateFilmRollRequest` 用 ——
 * 多了 id / createdAt / updatedAt 三個欄位，帶出去就是 400。
 * 需要一個轉換：
 *
 * ```ts
 * const initialValues: UpdateFilmRollRequest = {
 *   filmName: roll.filmName,
 *   brand: roll.brand,
 *   iso: roll.iso,
 *   format: roll.format,
 *   pushPullStops: roll.pushPullStops,
 *   loadedAt: roll.loadedAt,
 *   finishedAt: roll.finishedAt,
 *   cameraName: roll.cameraName,
 *   lensName: roll.lensName,
 *   notes: roll.notes,
 *   status: roll.status,
 * }
 * ```
 *
 * 💡 詳情頁推進狀態時需要**一模一樣**的轉換。
 *    兩邊都寫一次之後，把它抽成 `lib/toUpdateRequest.ts`。
 *    先重複一次再抽 —— 你會更清楚這個函式的邊界在哪。
 *
 * ### 步驟 3：送出
 *
 * ```ts
 * const navigate = useNavigate()
 * const updateMutation = useUpdateFilmRoll()
 *
 * function handleSubmit(values: UpdateFilmRollRequest) {
 *   updateMutation.mutate(
 *     { id: rollId, body: values },
 *     { onSuccess: () => navigate(`/film-rolls/${rollId}`) },
 *   )
 * }
 * ```
 *
 * ### 步驟 4：處理 409
 *
 * 編輯頁比新增頁多一種錯誤：狀態逆向流轉的 **409 Conflict**。
 *
 * 它跟 400 的差別要在 UI 上反映出來：
 *   400 = 「你填的內容有問題」→ 指向欄位，請使用者修正
 *   409 = 「你填的沒問題，但這個操作對這筆資料不成立」
 *        → 例如卷期已經 ARCHIVED，你想改回 SHOOTING
 *        → 訊息該是「已歸檔的卷期無法改回拍攝中」，而不是紅框框住 status 欄位
 *
 * 判斷：`error instanceof ApiError && error.status === 409`
 *
 * 💡 更好的做法是讓這件事在 UI 上不可能發生 ——
 *    表單的狀態下拉選單只列出「目前狀態及其之後」的選項。
 *    那 409 什麼時候還會出現？想一下：
 *    如果你開著編輯頁，同時在另一個分頁把它改成 ARCHIVED，會怎樣？
 *    這就是為什麼即使 UI 擋了，錯誤處理還是不能省。
 */
export default function FilmRollEditPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className={styles.page}>
      <Link to={`/film-rolls/${id}`} className={styles.back}>
        ← 回到卷期
      </Link>
      <h1 className={styles.title}>編輯卷期</h1>

      <div className={styles.placeholder}>
        <p>
          <strong>FilmRollEditPage</strong> 還沒實作（目前的 id 參數：<code>{id}</code>）。
        </p>
        <p>建議做完新增頁再做這一頁，兩者共用同一個表單元件。</p>
      </div>
    </div>
  )
}
