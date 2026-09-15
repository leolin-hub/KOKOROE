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
 * 【影響畫面】
 *   詳情頁按「編輯」進來的頁面：和新增頁是同一個表單，但欄位預先填好這卷目前的資料。
 *   按「儲存變更」→ 成功就跳回詳情頁；失敗就在表單上顯示錯誤。
 *
 * 【會用到】
 *   - useParams()、useNavigate()                 react-router（已 import）
 *   - useFilmRoll(id)                            hooks/useFilmRoll.ts（已 import）：讀出目前的資料
 *   - useUpdateFilmRoll()                        hooks/useFilmRollMutations.ts（已 import）
 *   - FilmRollForm、ErrorBanner                  components（已 import）
 *   - toFieldErrors(error)                       api/problem.ts（已 import）
 *   - 要自己加的 import：
 *       `ApiError`         → 加到 api/problem 那行
 *       `toUpdateRequest`  → `import { toUpdateRequest } from '../lib/toUpdateRequest'`（做詳情頁時建立的）
 *   - styles.page / back / title                 FilmRollFormPage.module.css
 *
 * 【步驟】
 * 1. 所有 hook 先呼叫（一定要在任何 return 之前）：
 *    ```ts
 *    const { id } = useParams<{ id: string }>()
 *    const rollId = Number(id)
 *    const navigate = useNavigate()
 *    const { data: roll, isPending, isError, error } = useFilmRoll(rollId)
 *    const updateMutation = useUpdateFilmRoll()
 *    ```
 *
 * 2. 和詳情頁一樣，依序 return 掉還不能顯示表單的情況：
 *    a. `if (!Number.isInteger(rollId) || rollId <= 0)` → 「網址不正確」（要放在 isPending 之前）
 *    b. `if (isPending)` → 「載入中…」
 *    c. `if (isError)` → 404 顯示「這卷不存在」，其他用 `<ErrorBanner error={error} />`
 *
 *    ⚠️ 資料還沒到之前「絕對不要」render FilmRollForm。
 *       表單的 useState 只在第一次出現時採用 initialValues；
 *       如果先用空值 render，資料到了表單還是空的，看起來會像「API 沒回資料」，很難查。
 *
 * 3. 送出：
 *    ```ts
 *    function handleSubmit(values: UpdateFilmRollRequest) {
 *      updateMutation.mutate(
 *        { id: rollId, body: values },
 *        { onSuccess: () => navigate(`/film-rolls/${rollId}`) },
 *      )
 *    }
 *    ```
 *
 * 4. 決定錯誤要顯示在哪裡（寫法和新增頁一樣）：
 *    ```ts
 *    const updateError = updateMutation.error
 *    const showBanner =
 *      updateError !== null && !(updateError instanceof ApiError && updateError.hasFieldErrors)
 *    ```
 *    - 400 有 errors 陣列 → 欄位下方
 *    - 409 狀態不能倒退 → banner。例如這卷在另一個分頁已經被改成「已歸檔」，你這裡還想存成「拍攝中」
 *    - 其他 → banner
 *    409 的訊息文字不用自己寫：ErrorBanner 內部用 toUserMessage 顯示後端回的說明。
 *
 * 5. 把下面的 `.placeholder` 區塊換成（「← 回到卷期」和標題保留）：
 *    ```tsx
 *    {showBanner && <ErrorBanner error={updateError} />}
 *    <FilmRollForm
 *      initialValues={toUpdateRequest(roll)}
 *      onSubmit={handleSubmit}
 *      isSubmitting={updateMutation.isPending}
 *      fieldErrors={toFieldErrors(updateError)}
 *      submitLabel="儲存變更"
 *      minStatus={roll.status}
 *    />
 *    ```
 *    - `toUpdateRequest(roll)`：把後端回傳的卷期轉成表單格式，拿掉 id、createdAt、updatedAt。
 *    - `minStatus={roll.status}`：狀態下拉只列出目前及之後的狀態，UI 上就選不到倒退的選項。
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
