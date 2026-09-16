import { Link, useNavigate, useParams } from 'react-router'
import { useFilmRoll } from '../hooks/useFilmRoll'
import { useUpdateFilmRoll } from '../hooks/useFilmRollMutations'
import FilmRollForm from '../components/FilmRollForm'
import ErrorBanner from '../components/ErrorBanner'
import { ApiError, toFieldErrors } from '../api/problem'
import { toUpdateRequest } from '../lib/toUpdateRequest'
import type { UpdateFilmRollRequest } from '../types/filmRoll'
import styles from './FormPage.module.css'

/**
 * 編輯卷期頁。路由 `/film-rolls/:id/edit`。
 *
 * 【影響畫面】詳情頁按「編輯」進來的頁面：和新增頁同一個表單，欄位預先填好這卷目前的資料。
 *   按「儲存變更」成功後跳回詳情頁；失敗時在表單上顯示錯誤。
 *
 * 【幾個刻意的設計】
 * - 資料到齊之前不 render FilmRollForm。表單的 useState 只在第一次 mount 時採用 initialValues，
 *   先用空值 render 的話，資料到了表單還是空的，看起來會像「API 沒回資料」。
 * - 網址的 id 不合法要在 isPending 之前處理：id 不合法時 useFilmRoll 不發請求，isPending 會永遠是 true。
 * - `minStatus={roll.status}` 讓狀態下拉只列出目前及之後的狀態。
 *   409 仍然可能出現（例如另一個分頁已經把這卷推進到已歸檔），所以錯誤處理不能省，交給 ErrorBanner 顯示後端訊息。
 */
export default function FilmRollEditPage() {
  const { id } = useParams<{ id: string }>()
  const rollId = Number(id)
  const navigate = useNavigate()
  const { data: roll, isPending, isError, error, refetch } = useFilmRoll(rollId)
  const updateMutation = useUpdateFilmRoll()

  function handleSubmit(values: UpdateFilmRollRequest) {
    updateMutation.mutate(
      { id: rollId, body: values },
      { onSuccess: () => navigate(`/film-rolls/${rollId}`) },
    )
  }

  const listLink = (
    <Link to="/film-rolls" className={styles.back}>
      ← 回到列表
    </Link>
  )

  if (!Number.isInteger(rollId) || rollId <= 0) {
    return (
      <div className={styles.page}>
        {listLink}
        <p className={styles.message}>網址不正確，找不到這卷底片。</p>
      </div>
    )
  }

  if (isPending) {
    return (
      <div className={styles.page}>
        {listLink}
        <p className={styles.message}>載入中…</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className={styles.page}>
        {listLink}
        {error instanceof ApiError && error.status === 404 ? (
          <p className={styles.message}>這卷不存在，可能已被刪除。</p>
        ) : (
          <ErrorBanner error={error} onRetry={() => void refetch()} />
        )}
      </div>
    )
  }

  const updateError = updateMutation.error
  const showBanner =
    updateError !== null && !(updateError instanceof ApiError && updateError.hasFieldErrors)

  return (
    <div className={styles.page}>
      <Link to={`/film-rolls/${rollId}`} className={styles.back}>
        ← 回到卷期
      </Link>
      <h1 className={styles.title}>編輯卷期</h1>

      {showBanner && <ErrorBanner error={updateError} />}
      <FilmRollForm
        initialValues={toUpdateRequest(roll)}
        onSubmit={handleSubmit}
        isSubmitting={updateMutation.isPending}
        fieldErrors={toFieldErrors(updateError)}
        submitLabel="儲存變更"
        minStatus={roll.status}
      />
    </div>
  )
}
