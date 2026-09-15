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
 * 【影響畫面】列表頁點一張卡片進來的頁面，由上到下：
 *   ← 回到列表
 *   標題（Kodak Portra 400）＋ 狀態 badge
 *   欄位清單：ISO、規格、增減感、裝片日期、拍完日期、相機、鏡頭、備註
 *   狀態推進按鈕（例如「推進到：沖洗中」）＋「編輯」連結
 *   刪除按鈕（危險區）
 *   建立時間 / 最後更新時間
 *
 * 【會用到】
 *   - useParams()、useNavigate()                      react-router（已 import）
 *   - useFilmRoll(id)                                 hooks/useFilmRoll.ts（已 import）：讀資料
 *   - useUpdateFilmRoll()、useDeleteFilmRoll()        hooks/useFilmRollMutations.ts（已 import）
 *   - StatusBadge、ErrorBanner                        components（已 import）
 *   - formatRollTitle、formatDate、formatInstant、formatPushPull   lib/format.ts（已 import）
 *   - STATUS_ORDER、STATUS_LABELS                     lib/constants.ts（已 import）
 *   - 要自己加的 import：
 *       `EMPTY_PLACEHOLDER`  → 加到 lib/format 那行，空欄位顯示「—」
 *       `FORMAT_OPTIONS`     → 加到 lib/constants 那行，規格顯示「135（35mm）」
 *       `ApiError`           → `import { ApiError } from '../api/problem'`
 *       `FilmRollStatus`     → `import type { FilmRollStatus } from '../types/filmRoll'`
 *       `toUpdateRequest`    → 步驟 4 要新建的 `lib/toUpdateRequest.ts`
 *   - styles.page / back / header / title / fields / fieldLabel / fieldValue / actions / dangerZone / meta
 *
 * ══════════════════════════════════════════════════
 * 步驟 1：所有 hook 先呼叫（一定要在任何 return 之前）
 * ══════════════════════════════════════════════════
 *
 * ```ts
 * const { id } = useParams<{ id: string }>()
 * const rollId = Number(id)
 * const navigate = useNavigate()
 * const { data: roll, isPending, isError, error } = useFilmRoll(rollId)
 * const updateMutation = useUpdateFilmRoll()
 * const deleteMutation = useDeleteFilmRoll()
 * ```
 *
 * ══════════════════════════════════════════════════
 * 步驟 2：依序處理「還不能顯示內容」的情況，每種都直接 return
 * ══════════════════════════════════════════════════
 *
 * 每個 return 的畫面都要包含「← 回到列表」，使用者才回得去。
 *
 * a. 網址上的 id 不是正整數（例如 /film-rolls/abc）：
 *    `if (!Number.isInteger(rollId) || rollId <= 0)` → 顯示「網址不正確」
 *    ⚠️ 這個判斷一定要放在 isPending 之前：id 不合法時 useFilmRoll 不會發請求，
 *       isPending 會永遠是 true，畫面會一直卡在「載入中」。
 *
 * b. `if (isPending)` → 顯示「載入中…」
 *
 * c. `if (isError)`：
 *    - `error instanceof ApiError && error.status === 404` → 顯示「這卷不存在，可能已被刪除」
 *    - 其他錯誤 → `<ErrorBanner error={error} />`
 *
 * 走到這裡之後，TypeScript 已經知道 `roll` 一定有值。
 *
 * ══════════════════════════════════════════════════
 * 步驟 3：顯示欄位
 * ══════════════════════════════════════════════════
 *
 * 標題列：`<div className={styles.header}>` 裡放
 *   `<h1 className={styles.title}>{formatRollTitle(roll.filmName, roll.brand)}</h1>` 和 `<StatusBadge status={roll.status} />`
 *
 * 欄位清單用 `<dl className={styles.fields}>`，每一欄是
 *   `<dt className={styles.fieldLabel}>ISO</dt><dd className={styles.fieldValue}>{roll.iso}</dd>`
 *
 * 和列表卡片不同：詳情頁的選填欄位沒有值也要顯示那一列，值用「—」。
 *   - 規格：`FORMAT_OPTIONS.find((o) => o.value === roll.format)?.label ?? roll.format`
 *   - 增減感：`formatPushPull(roll.pushPullStops)`
 *   - 裝片日期 / 拍完日期：`formatDate(roll.loadedAt)`、`formatDate(roll.finishedAt)`（undefined 會自動顯示「—」）
 *   - 相機 / 鏡頭 / 備註：`roll.cameraName ?? EMPTY_PLACEHOLDER`
 *   - 建立 / 更新時間：`formatInstant(roll.createdAt)`、`formatInstant(roll.updatedAt)`，放在頁面最下面的 `styles.meta`
 *
 * ══════════════════════════════════════════════════
 * 步驟 4：推進狀態按鈕
 * ══════════════════════════════════════════════════
 *
 * PUT 是「整份取代」，所以要把這卷的所有欄位帶齊再改 status。
 * 先新建 `src/lib/toUpdateRequest.ts`（編輯頁也會用到同一個轉換）：
 *
 * ```ts
 * import type { FilmRollResponse, UpdateFilmRollRequest } from '../types/filmRoll'
 *
 * export function toUpdateRequest(roll: FilmRollResponse): UpdateFilmRollRequest {
 *   return {
 *     filmName: roll.filmName,
 *     brand: roll.brand,
 *     iso: roll.iso,
 *     format: roll.format,
 *     pushPullStops: roll.pushPullStops,
 *     loadedAt: roll.loadedAt,
 *     finishedAt: roll.finishedAt,
 *     cameraName: roll.cameraName,
 *     lensName: roll.lensName,
 *     notes: roll.notes,
 *     status: roll.status,
 *   }
 * }
 * ```
 *
 * ⚠️ 不能偷懶寫成 `{ ...roll }`：那會把 id、createdAt、updatedAt 一起送出去，
 *    後端設了 fail-on-unknown-properties，會直接回 400。
 *
 * 然後在頁面裡（步驟 2 的 return 之後）：
 *
 * ```ts
 * const baseRequest = toUpdateRequest(roll)
 * const nextStatuses = STATUS_ORDER.slice(STATUS_ORDER.indexOf(roll.status) + 1)
 *
 * function handleAdvance(next: FilmRollStatus) {
 *   updateMutation.mutate({ id: rollId, body: { ...baseRequest, status: next } })
 * }
 * ```
 *
 * - `nextStatuses` 只包含比目前更後面的狀態，已歸檔時是空陣列，就不會顯示任何推進按鈕。
 *   按鈕：`nextStatuses.map((s) => <button key={s} type="button" onClick={() => handleAdvance(s)} disabled={updateMutation.isPending}>推進到：{STATUS_LABELS[s]}</button>)`
 * - 為什麼先算出 `baseRequest` 而不是在 handleAdvance 裡直接用 `roll`：
 *   TypeScript 在函式裡面會「忘記」roll 已經確認過有值，直接用會報「roll 可能是 undefined」。
 *   baseRequest 的型別本身就不含 undefined，沒有這個問題。
 *
 * 編輯連結和推進按鈕放在一起：
 *   `<div className={styles.actions}>` 裡放推進按鈕和 `<Link to={`/film-rolls/${rollId}/edit`}>編輯</Link>`
 *
 * ══════════════════════════════════════════════════
 * 步驟 5：刪除
 * ══════════════════════════════════════════════════
 *
 * ```ts
 * const title = formatRollTitle(roll.filmName, roll.brand)
 *
 * function handleDelete() {
 *   if (!window.confirm(`確定要刪除「${title}」嗎？此動作無法復原。`)) return
 *   deleteMutation.mutate(rollId, {
 *     onSuccess: () => navigate('/film-rolls', { replace: true }),
 *   })
 * }
 * ```
 *
 * - 刪除按鈕放在 `<div className={styles.dangerZone}>` 裡，`disabled={deleteMutation.isPending}`。
 * - `replace: true`：把詳情頁從瀏覽紀錄換掉，按上一頁才不會回到已經刪除的卷期（404）。
 * - `window.confirm` 是瀏覽器內建的確認視窗，先用它就好，不用自己做彈出視窗。
 * - hook 裡的 onSuccess 和這裡 mutate 的 onSuccess 兩個都會執行：
 *   快取處理寫在 hook（每個頁面都需要），跳頁寫在這裡（只有這一頁需要）。
 *
 * ══════════════════════════════════════════════════
 * 步驟 6：推進或刪除失敗時的訊息
 * ══════════════════════════════════════════════════
 *
 * 放在按鈕上方：
 * ```tsx
 * {updateMutation.error && <ErrorBanner error={updateMutation.error} />}
 * {deleteMutation.error && <ErrorBanner error={deleteMutation.error} />}
 * ```
 *
 * 最後把 `.placeholder` 區塊刪掉。
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
