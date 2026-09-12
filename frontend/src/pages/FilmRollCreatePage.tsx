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
 * 這一頁很薄 —— 表單的狀態與欄位都在 `FilmRollForm` 裡。
 * 這裡只負責三件事：呼叫 mutation、把錯誤轉成表單看得懂的形狀、成功後導頁。
 *
 * 為什麼要這樣切：`FilmRollForm` 同時被新增頁與編輯頁使用，
 * 但兩者的「送出後要做什麼」完全不同（一個導到新資源，一個留在原地）。
 * 把差異留在頁面、共用的部分放元件，才不會在 Form 裡長出
 * `if (mode === 'create')` 這種分支。
 *
 * ══════════════════════════════════════════════════
 * TODO(你來寫)
 * ══════════════════════════════════════════════════
 *
 * ```ts
 * const navigate = useNavigate()
 * const createMutation = useCreateFilmRoll()
 *
 * function handleSubmit(values: CreateFilmRollRequest) {
 *   createMutation.mutate(values, {
 *     onSuccess: (created) => navigate(`/film-rolls/${created.id}`),
 *   })
 * }
 * ```
 *
 * 然後把這三樣傳給 `<FilmRollForm>`：
 *   - `onSubmit={handleSubmit}`
 *   - `isSubmitting={createMutation.isPending}` —— 讓按鈕在送出期間 disabled。
 *     ⚠️ 這不只是體驗問題：沒有它，使用者連點三下就會新增三卷。
 *   - `fieldErrors={toFieldErrors(createMutation.error)}` —— 把後端 400 的
 *     errors 陣列攤回各欄位下方
 *
 * 關於錯誤的雙軌呈現（想清楚這件事，它是表單體驗的關鍵）：
 *
 *   400 validation-failed      → 有 `errors` 陣列 → 攤到欄位下方
 *   400 business-rule-violated → **沒有** errors 陣列（例如「完成日期不得早於裝片日期」）
 *                                → 這種跨欄位錯誤沒有單一歸屬的欄位，
 *                                  要用 `<ErrorBanner>` 在表單頂端整體呈現
 *   500 / 網路錯誤              → 同樣走 ErrorBanner
 *
 * 所以兩種呈現方式都需要，不是二選一。
 * 判斷依據：`createMutation.error` 若 `hasFieldErrors` 為 true 走欄位，否則走 banner。
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
