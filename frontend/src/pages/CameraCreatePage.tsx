import { Link, useNavigate } from 'react-router'
import { useCreateCamera } from '../hooks/useCameraMutations'
import CameraForm from '../components/CameraForm'
import ErrorBanner from '../components/ErrorBanner'
import { ApiError, toFieldErrors } from '../api/problem'
import { emptyCameraValues } from '../lib/camera'
import type { CreateCameraRequest } from '../types/camera'
import styles from './FormPage.module.css'

/**
 * 新增相機頁。路由 `/cameras/new`。
 *
 * 【影響畫面】相機列表頁「新增相機」點進來的頁面，成功後回到相機列表。
 *
 * 錯誤呈現同卷期新增頁：欄位錯誤顯示在欄位下方，其他（同名的 409、可換鏡頭卻填定焦鏡頭的 400）用 ErrorBanner。
 */
export default function CameraCreatePage() {
  const navigate = useNavigate()
  const createMutation = useCreateCamera()

  function handleSubmit(values: CreateCameraRequest) {
    createMutation.mutate(values, { onSuccess: () => navigate('/cameras') })
  }

  const error = createMutation.error
  const showBanner = error !== null && !(error instanceof ApiError && error.hasFieldErrors)

  return (
    <div className={styles.page}>
      <Link to="/cameras" className={styles.back}>
        ← 回到相機
      </Link>
      <h1 className={styles.title}>新增相機</h1>

      {showBanner && <ErrorBanner error={error} />}
      <CameraForm
        initialValues={emptyCameraValues()}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending}
        fieldErrors={toFieldErrors(error)}
        submitLabel="建立相機"
      />
    </div>
  )
}
