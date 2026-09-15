import { Link, useNavigate } from 'react-router'
import { useCreateFilmRoll } from '../hooks/useFilmRollMutations'
import FilmRollForm from '../components/FilmRollForm'
import ErrorBanner from '../components/ErrorBanner'
import { toFieldErrors } from '../api/problem'
import type { CreateFilmRollRequest } from '../types/filmRoll'
import styles from './FilmRollFormPage.module.css'

/**
 * 新增卷期頁。路由 `/film-rolls/new`。
 *
 * 【影響畫面】
 *   列表頁右上角「裝新的一卷」點進來的頁面。
 *   填完表單按「建立卷期」→ 成功就跳到這卷的詳情頁；失敗就在表單上顯示錯誤。
 *
 * 【這一頁只做三件事】表單的欄位與狀態都在 FilmRollForm 裡，這裡只負責：
 *   1. 呼叫新增 API
 *   2. 把錯誤交給表單或 banner 顯示
 *   3. 成功後跳頁
 *
 * 【會用到】
 *   - useNavigate()                      react-router（已 import）：跳頁
 *   - useCreateFilmRoll()                hooks/useFilmRollMutations.ts（已 import）
 *   - FilmRollForm                       components/FilmRollForm.tsx（已 import）
 *   - emptyFormValues()                  components/FilmRollForm.tsx（要自己加 import）：
 *                                        `import FilmRollForm, { emptyFormValues } from '../components/FilmRollForm'`
 *   - toFieldErrors(error)               api/problem.ts（已 import）：把 400 的欄位錯誤轉成 `{ filmName: '...' }`
 *   - ApiError                           api/problem.ts（要自己加 import）：判斷要不要顯示 banner
 *   - ErrorBanner                        components/ErrorBanner.tsx（已 import）
 *   - styles.page / back / title         FilmRollFormPage.module.css
 *
 * 【步驟】
 * 1. 最上面先呼叫 hook：
 *    ```ts
 *    const navigate = useNavigate()
 *    const createMutation = useCreateFilmRoll()
 *    ```
 *
 * 2. 送出時呼叫 mutate，成功就跳到新卷期的詳情頁：
 *    ```ts
 *    function handleSubmit(values: CreateFilmRollRequest) {
 *      createMutation.mutate(values, {
 *        onSuccess: (created) => navigate(`/film-rolls/${created.id}`),
 *      })
 *    }
 *    ```
 *
 * 3. 決定錯誤要顯示在哪裡：
 *    ```ts
 *    const error = createMutation.error
 *    const showBanner = error !== null && !(error instanceof ApiError && error.hasFieldErrors)
 *    ```
 *    - 400 而且有 errors 陣列（例如「底片名稱不可為空」）→ 顯示在欄位下方，不顯示 banner
 *    - 400 但沒有 errors 陣列（例如「拍完日期不可早於裝片日期」，牽涉兩個欄位）→ banner
 *    - 500、網路斷線 → banner
 *
 * 4. 把下面的 `.placeholder` 區塊整段換成（「← 回到列表」和標題保留）：
 *    ```tsx
 *    {showBanner && <ErrorBanner error={error} />}
 *    <FilmRollForm
 *      initialValues={emptyFormValues()}
 *      onSubmit={handleSubmit}
 *      isSubmitting={createMutation.isPending}
 *      fieldErrors={toFieldErrors(error)}
 *      submitLabel="建立卷期"
 *    />
 *    ```
 *    - `isSubmitting={createMutation.isPending}`：送出期間按鈕 disabled，防止連點建立好幾卷。
 *    - `emptyFormValues()` 每次 render 都會重算沒關係，表單的 useState 只在第一次採用它。
 *    - 這裡不傳 `minStatus`，新增時四個狀態都能選。
 */
export default function FilmRollCreatePage() {
  return (
    <div className={styles.page}>
      <Link to="/film-rolls" className={styles.back}>
        ← 回到列表
      </Link>
      <h1 className={styles.title}>裝新的一卷</h1>

      <div className={styles.placeholder}>
        <p>
          <strong>FilmRollCreatePage</strong> 還沒實作。
        </p>
        <p>
          需要 <code>components/FilmRollForm.tsx</code> 與{' '}
          <code>hooks/useFilmRollMutations.ts</code>。
        </p>
      </div>
    </div>
  )
}
