import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useCameras } from '../hooks/useCameras'
import ErrorBanner from '../components/ErrorBanner'
import {
  CAMERA_FORMAT_LABELS,
  CAMERA_TYPE_LABELS,
  FILM_ADVANCE_LABELS,
  FOCUS_TYPE_LABELS,
} from '../lib/constants'
import type { CameraResponse } from '../types/camera'
import styles from './CameraListPage.module.css'

/**
 * 相機的規格摘要，例如「傻瓜機 · 自動對焦 · 35mm f/4.5 · 有閃光燈」。
 * 沒填（不知道）的規格直接略過，不顯示「—」：一排佔位符在卡片上很吵，理由同 FilmRollCard。
 */
function specSummary(camera: CameraResponse): string[] {
  const specs: (string | undefined)[] = [
    camera.cameraType && CAMERA_TYPE_LABELS[camera.cameraType],
    camera.focusType && FOCUS_TYPE_LABELS[camera.focusType],
    camera.filmAdvance && FILM_ADVANCE_LABELS[camera.filmAdvance],
    camera.fixedLens,
    camera.interchangeableLens ? '可換鏡頭' : undefined,
    camera.hasFlash === undefined ? undefined : camera.hasFlash ? '有閃光燈' : '無閃光燈',
    camera.isoMin && camera.isoMax ? `ISO ${camera.isoMin}–${camera.isoMax}` : undefined,
  ]
  return specs.filter((s): s is string => Boolean(s))
}

/**
 * 相機列表頁。路由 `/cameras`。
 *
 * 【影響畫面】上方導覽列「相機」點進來的頁面：每台相機一張卡片，點卡片進入編輯頁。
 *
 * 相機數量少，後端一頁就回傳全部，所以沒有篩選、排序與分頁（排序由後端依品牌、型號排好）。
 * 刪除放在編輯頁裡，與卷期「詳情頁才能刪」的位置一致，避免在列表上誤刪。
 */
export default function CameraListPage() {
  const { data: cameras, isPending, isError, error, refetch } = useCameras()

  let content: ReactNode
  if (isPending) {
    content = <p className={styles.message}>載入中…</p>
  } else if (isError) {
    content = <ErrorBanner error={error} onRetry={() => void refetch()} />
  } else if (cameras.length === 0) {
    content = (
      <div className={styles.empty}>
        <p>還沒有任何相機。</p>
        <Link to="/cameras/new">新增第一台相機</Link>
      </div>
    )
  } else {
    content = (
      <ul className={styles.list}>
        {cameras.map((camera) => {
          const specs = specSummary(camera)
          return (
            <li key={camera.id}>
              <Link to={`/cameras/${camera.id}/edit`} className={styles.card}>
                <div className={styles.header}>
                  <h2 className={styles.name}>{camera.name}</h2>
                  <span className={styles.format}>{CAMERA_FORMAT_LABELS[camera.format]}</span>
                </div>
                <p className={styles.specs}>
                  {specs.length > 0 ? specs.join(' · ') : '規格還沒填，點進來補上'}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>我的相機</h1>
        <Link to="/cameras/new" className={styles.newButton}>
          新增相機
        </Link>
      </div>
      {content}
    </div>
  )
}
