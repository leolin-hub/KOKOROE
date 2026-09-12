import { Link, useNavigate, useParams } from 'react-router'
import { useFilmRoll } from '../hooks/useFilmRoll'
import { useDeleteFilmRoll, useUpdateFilmRoll } from '../hooks/useFilmRollMutations'
import StatusBadge from '../components/StatusBadge'
import ErrorBanner from '../components/ErrorBanner'
import { formatDate, formatInstant, formatPushPull, formatRollTitle } from '../lib/format'
import { STATUS_LABELS, STATUS_ORDER } from '../lib/constants'
import styles from './FilmRollDetailPage.module.css'

/**
 * 卷期詳情頁。路由 `/film-rolls/:id`。
 *
 * ══════════════════════════════════════════════════
 * TODO(你來寫)
 * ══════════════════════════════════════════════════
 *
 * ### 步驟 1：拿到 id
 *
 * ```ts
 * const { id } = useParams<{ id: string }>()
 * const rollId = Number(id)
 * ```
 *
 * ⚠️ `useParams` 回傳的值型別是 `string | undefined`，而且**永遠**可能是任何字串。
 *    `/film-rolls/abc` 是一個合法的路由命中，`Number('abc')` 是 NaN。
 *    這就是 `useFilmRoll` 裡要求你寫 `enabled` 的原因。
 *    這一頁也該自己處理：若 `!Number.isInteger(rollId)`，
 *    直接顯示「網址不正確」，而不是送一個註定失敗的請求。
 *
 * ### 步驟 2：讀資料
 *
 * ```ts
 * const { data: roll, isLoading, isError, error } = useFilmRoll(rollId)
 * ```
 *
 * 404 要特別處理。`error instanceof ApiError && error.status === 404`
 * 該顯示「這卷不存在，可能已被刪除」而不是通用錯誤 —— 使用者需要知道
 * 這是「東西沒了」而不是「系統壞了」，因為後者會讓人一直重試。
 *
 * ### 步驟 3：刪除
 *
 * ```ts
 * const navigate = useNavigate()
 * const deleteMutation = useDeleteFilmRoll()
 *
 * function handleDelete() {
 *   // 先確認。用 window.confirm 起步完全可以 ——
 *   // 自己做 modal 是另一個題目，別在這裡分心。
 *   if (!window.confirm(`確定要刪除「${roll.filmName}」嗎？此動作無法復原。`)) return
 *
 *   deleteMutation.mutate(rollId, {
 *     onSuccess: () => navigate('/film-rolls', { replace: true }),
 *   })
 * }
 * ```
 *
 * ⚠️ 為什麼刪除後要用 `replace: true`：
 *    若用一般的 navigate，這一頁會留在瀏覽歷史裡。使用者按上一頁
 *    會回到一個已經不存在的資源 → 404。`replace` 把它從歷史中換掉。
 *
 * 💡 `mutate` 的第二個參數也能放 `onSuccess`，與 hook 裡定義的那個
 *    **兩個都會執行**（hook 的先跑）。分工慣例是：
 *    快取失效寫在 hook 裡（每個呼叫端都需要），
 *    導頁寫在呼叫端（只有這一頁需要）。
 *
 * ### 步驟 4：推進狀態（這一頁最有價值的部分）
 *
 * 做一排按鈕讓使用者把卷期往前推：已裝片 → 拍攝中 → 沖洗中 → 已歸檔。
 *
 * ```ts
 * const updateMutation = useUpdateFilmRoll()
 *
 * function handleAdvance(next: FilmRollStatus) {
 *   updateMutation.mutate({
 *     id: rollId,
 *     body: {
 *       // ⚠️ PUT 是整份取代，所以必須帶齊所有欄位，
 *       //    但**只能**帶 UpdateFilmRollRequest 有的欄位。
 *       //    絕對不要寫 `...roll` —— 那會混進 id / createdAt / updatedAt，
 *       //    後端的 fail-on-unknown-properties 會直接回 400。
 *       filmName: roll.filmName,
 *       brand: roll.brand,
 *       iso: roll.iso,
 *       format: roll.format,
 *       pushPullStops: roll.pushPullStops,
 *       loadedAt: roll.loadedAt,
 *       finishedAt: roll.finishedAt,
 *       cameraName: roll.cameraName,
 *       lensName: roll.lensName,
 *       notes: roll.notes,
 *       status: next,
 *     },
 *   })
 * }
 * ```
 *
 * 💡 上面那段「手動抄十個欄位」很囉唆，而且新增欄位時容易漏。
 *    寫完之後，考慮把它抽成一支函式放到 `lib/`：
 *    `toUpdateRequest(roll: FilmRollResponse): UpdateFilmRollRequest`
 *    編輯頁也需要同一個轉換，抽出來就只有一處要維護。
 *    （先手寫一次再抽 —— 你會更清楚為什麼需要它。）
 *
 * 哪些按鈕該出現？狀態只能向前，所以只顯示 sequence 比目前大的。
 * 提示：`STATUS_ORDER.slice(STATUS_ORDER.indexOf(roll.status) + 1)`
 *
 * 這樣 UI 就在結構上不可能送出逆向請求。比「送出去讓後端擋」好得多 ——
 * 但後端的檢查依然必要，因為 API 不只有你的 UI 會呼叫。
 * 前端擋是為了體驗，後端擋是為了正確性。兩者不能互相取代。
 */
export default function FilmRollDetailPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className={styles.page}>
      <Link to="/film-rolls" className={styles.back}>
        ← 回到列表
      </Link>

      <div className={styles.placeholder}>
        <p>
          <strong>FilmRollDetailPage</strong> 還沒實作（目前的 id 參數：<code>{id}</code>）。
        </p>
        <p>
          需要 <code>hooks/useFilmRoll.ts</code> 與{' '}
          <code>hooks/useFilmRollMutations.ts</code>。
        </p>
      </div>
    </div>
  )
}
