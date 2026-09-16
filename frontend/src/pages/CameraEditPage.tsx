import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useCamera } from '../hooks/useCamera'
import { useDeleteCamera, useUpdateCamera } from '../hooks/useCameraMutations'
import CameraForm from '../components/CameraForm'
import ErrorBanner from '../components/ErrorBanner'
import { ApiError, toFieldErrors } from '../api/problem'
import { toCameraRequest } from '../lib/camera'
import type { UpdateCameraRequest } from '../types/camera'
import styles from './FormPage.module.css'

/**
 * 編輯相機頁。路由 `/cameras/:id/edit`。
 *
 * 【影響畫面】相機列表點一張卡片進來：表單帶入這台相機的規格，下方是刪除按鈕。
 *   儲存或刪除成功後都回到相機列表。
 *
 * 【幾個刻意的設計】（載入、id 不合法、404 的處理同卷期編輯頁與詳情頁）
 * - 相機沒有獨立的詳情頁，刪除就放在這裡，用分隔線與表單隔開。
 * - 兩種 409 都交給 ErrorBanner 顯示後端的訊息，使用者看得懂下一步：
 *     刪除：「還有 N 卷底片使用中，請先修改這些卷期的相機」
 *     儲存：改成同名、或改片幅會讓使用中的卷期不相容
 * - 刪除成功後暫停查詢（`enabled: !deleteMutation.isSuccess`），理由同卷期詳情頁。
 */
export default function CameraEditPage() {
  const { id } = useParams<{ id: string }>()
  const cameraId = Number(id)
  const navigate = useNavigate()
  const updateMutation = useUpdateCamera()
  const deleteMutation = useDeleteCamera()
  const { data: camera, isPending, isError, error, refetch } = useCamera(cameraId, {
    enabled: !deleteMutation.isSuccess,
  })

  function renderMessage(content: ReactNode) {
    return (
      <div className={styles.page}>
        <Link to="/cameras" className={styles.back}>
          ← 回到相機
        </Link>
        {content}
      </div>
    )
  }

  if (!Number.isInteger(cameraId) || cameraId <= 0) {
    return renderMessage(<p className={styles.message}>網址不正確，找不到這台相機。</p>)
  }

  if (deleteMutation.isSuccess) {
    return renderMessage(<p className={styles.message}>已刪除，正在回到相機列表…</p>)
  }

  if (isPending) {
    return renderMessage(<p className={styles.message}>載入中…</p>)
  }

  if (isError) {
    return renderMessage(
      error instanceof ApiError && error.status === 404 ? (
        <p className={styles.message}>這台相機不存在，可能已被刪除。</p>
      ) : (
        <ErrorBanner error={error} onRetry={() => void refetch()} />
      ),
    )
  }

  function handleSubmit(values: UpdateCameraRequest) {
    updateMutation.mutate({ id: cameraId, body: values }, { onSuccess: () => navigate('/cameras') })
  }

  const name = camera.name
  function handleDelete() {
    if (!window.confirm(`確定要刪除「${name}」嗎？此動作無法復原。`)) return
    deleteMutation.mutate(cameraId, {
      onSuccess: () => navigate('/cameras', { replace: true }),
    })
  }

  const updateError = updateMutation.error
  const showBanner =
    updateError !== null && !(updateError instanceof ApiError && updateError.hasFieldErrors)
  const isBusy = updateMutation.isPending || deleteMutation.isPending

  return (
    <div className={styles.page}>
      <Link to="/cameras" className={styles.back}>
        ← 回到相機
      </Link>
      <h1 className={styles.title}>{camera.name}</h1>

      {showBanner && <ErrorBanner error={updateError} />}
      <CameraForm
        initialValues={toCameraRequest(camera)}
        onSubmit={handleSubmit}
        isSubmitting={isBusy}
        fieldErrors={toFieldErrors(updateError)}
        submitLabel="儲存變更"
      />

      {deleteMutation.error && <ErrorBanner error={deleteMutation.error} />}
      <div className={styles.dangerZone}>
        <button
          type="button"
          className={styles.deleteButton}
          onClick={handleDelete}
          disabled={isBusy}
        >
          {deleteMutation.isPending ? '刪除中…' : '刪除這台相機'}
        </button>
      </div>
    </div>
  )
}
