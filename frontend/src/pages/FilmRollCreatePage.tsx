import { Link, useNavigate } from 'react-router'
import { useCreateFilmRoll } from '../hooks/useFilmRollMutations'
import FilmRollForm, { emptyFormValues } from '../components/FilmRollForm'
import ErrorBanner from '../components/ErrorBanner'
import { ApiError, toFieldErrors } from '../api/problem'
import type { CreateFilmRollRequest } from '../types/filmRoll'
import styles from './FilmRollFormPage.module.css'

/**
 * 新增卷期頁。路由 `/film-rolls/new`。
 *
 * 【影響畫面】列表頁右上角「裝新的一卷」點進來的頁面。
 *   按「建立卷期」成功後跳到新卷期的詳情頁；失敗時在表單上顯示錯誤。
 *
 * 表單的欄位與狀態都在 FilmRollForm 裡，這一頁只負責：呼叫新增 API、決定錯誤顯示在哪、成功後跳頁。
 * 新增頁與編輯頁「送出後要做什麼」不同，所以差異留在頁面，表單元件裡不需要 `if (mode === 'create')`。
 *
 * 錯誤分兩種呈現：
 *   400 且有 errors 陣列（例如「底片名稱不可為空」）→ 顯示在對應欄位下方
 *   400 沒有 errors 陣列（例如「拍完日期不可早於裝片日期」，牽涉兩個欄位）、500、網路錯誤 → 表單上方的 ErrorBanner
 */
export default function FilmRollCreatePage() {
  const navigate = useNavigate()
  const createMutation = useCreateFilmRoll()

  function handleSubmit(values: CreateFilmRollRequest) {
    createMutation.mutate(values, {
      onSuccess: (created) => navigate(`/film-rolls/${created.id}`),
    })
  }

  const error = createMutation.error
  const showBanner =
    error !== null && !(error instanceof ApiError && error.hasFieldErrors)

  return (
    <div className={styles.page}>
      <Link to="/film-rolls" className={styles.back}>
        ← 回到列表
      </Link>
      <h1 className={styles.title}>裝新的一卷</h1>

      {showBanner && <ErrorBanner error={error} />}
      {/* emptyFormValues() 每次 render 都會重算沒關係：表單的 useState 只在第一次採用它 */}
      <FilmRollForm
        initialValues={emptyFormValues()}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending}
        fieldErrors={toFieldErrors(error)}
        submitLabel="建立卷期"
      />
    </div>
  )
}
