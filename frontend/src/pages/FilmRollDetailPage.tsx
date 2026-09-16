import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useFilmRoll } from '../hooks/useFilmRoll'
import { useDeleteFilmRoll, useUpdateFilmRoll } from '../hooks/useFilmRollMutations'
import StatusBadge from '../components/StatusBadge'
import ErrorBanner from '../components/ErrorBanner'
import { ApiError } from '../api/problem'
import {
  EMPTY_PLACEHOLDER,
  formatDate,
  formatInstant,
  formatPushPull,
  formatRollTitle,
} from '../lib/format'
import { FORMAT_OPTIONS, STATUS_LABELS, STATUS_ORDER } from '../lib/constants'
import { toUpdateRequest } from '../lib/toUpdateRequest'
import type { FilmRollStatus } from '../types/filmRoll'
import styles from './FilmRollDetailPage.module.css'

/**
 * 卷期詳情頁。路由 `/film-rolls/:id`。
 *
 * 【影響畫面】列表頁點一張卡片進來的頁面，由上到下：
 *   ← 回到列表
 *   標題（Kodak Portra 400）＋ 狀態 badge
 *   欄位清單：ISO、規格、增減感、裝片日期、拍完日期、相機、鏡頭、備註
 *   推進狀態按鈕（例如「推進到：沖洗中」）＋ 編輯連結
 *   刪除按鈕（與上面用分隔線隔開）
 *   建立時間 / 最後更新時間
 *
 * 【幾個刻意的設計】
 * - 網址的 id 不合法要在 isPending 之前處理：id 不合法時 useFilmRoll 不發請求，isPending 會永遠是 true。
 * - 404 顯示「這卷不存在」而不是通用錯誤：使用者要知道是「東西沒了」而不是「系統壞了」，才不會一直重試。
 * - 與列表卡片不同，選填欄位沒有值也顯示那一列（值為「—」），讓使用者知道「這欄是空的」。
 * - 推進狀態列出所有比目前更後面的狀態：後端允許跳關（例如報銷的卷片直接歸檔），但不允許倒退。
 *   UI 上不提供倒退的按鈕，後端的 409 檢查仍然存在，因為 API 不只有這個畫面會呼叫。
 * - PUT 是整份取代，body 用 `toUpdateRequest(roll)` 帶齊欄位再改 status，不能用 `{ ...roll }`。
 *   先在 render 裡算出 `baseRequest`，handler 裡就不必再用到 `roll`
 *   （TypeScript 在函式內部會忘記 roll 已經確認過有值）。
 * - 刪除成功後暫停查詢（`enabled: !deleteMutation.isSuccess`）：跳回列表前頁面還會再 render 一次，
 *   這時快取已被移除，不暫停的話會重抓一次、拿到 404，畫面也會閃一下「載入中」。
 * - 刪除後用 `replace: true` 跳頁，把這一頁從瀏覽紀錄換掉，按上一頁才不會回到已刪除的卷期。
 */
export default function FilmRollDetailPage() {
  const { id } = useParams<{ id: string }>()
  const rollId = Number(id)
  const navigate = useNavigate()
  const updateMutation = useUpdateFilmRoll()
  const deleteMutation = useDeleteFilmRoll()
  const { data: roll, isPending, isError, error, refetch } = useFilmRoll(rollId, {
    enabled: !deleteMutation.isSuccess,
  })

  const backLink = (
    <Link to="/film-rolls" className={styles.back}>
      ← 回到列表
    </Link>
  )

  /** 還不能顯示內容時（網址錯誤、已刪除、載入中）的畫面。 */
  function renderMessage(content: ReactNode) {
    return (
      <div className={styles.page}>
        {backLink}
        {content}
      </div>
    )
  }

  if (!Number.isInteger(rollId) || rollId <= 0) {
    return renderMessage(<p className={styles.message}>網址不正確，找不到這卷底片。</p>)
  }

  if (deleteMutation.isSuccess) {
    return renderMessage(<p className={styles.message}>已刪除，正在回到列表…</p>)
  }

  if (isPending) {
    return renderMessage(<p className={styles.message}>載入中…</p>)
  }

  if (isError) {
    return renderMessage(
      error instanceof ApiError && error.status === 404 ? (
        <p className={styles.message}>這卷不存在，可能已被刪除。</p>
      ) : (
        <ErrorBanner error={error} onRetry={() => void refetch()} />
      ),
    )
  }

  const title = formatRollTitle(roll.filmName, roll.brand)
  const baseRequest = toUpdateRequest(roll)
  const nextStatuses = STATUS_ORDER.slice(STATUS_ORDER.indexOf(roll.status) + 1)
  const isBusy = updateMutation.isPending || deleteMutation.isPending

  const fields: { label: string; value: ReactNode }[] = [
    { label: 'ISO', value: roll.iso },
    {
      label: '規格',
      value: FORMAT_OPTIONS.find((o) => o.value === roll.format)?.label ?? roll.format,
    },
    { label: '增減感', value: formatPushPull(roll.pushPullStops) },
    { label: '裝片日期', value: formatDate(roll.loadedAt) },
    { label: '拍完日期', value: formatDate(roll.finishedAt) },
    { label: '相機', value: roll.camera?.name ?? EMPTY_PLACEHOLDER },
    { label: '鏡頭', value: roll.lensName ?? EMPTY_PLACEHOLDER },
    { label: '備註', value: roll.notes ?? EMPTY_PLACEHOLDER },
  ]

  function handleAdvance(next: FilmRollStatus) {
    updateMutation.mutate({ id: rollId, body: { ...baseRequest, status: next } })
  }

  function handleDelete() {
    if (!window.confirm(`確定要刪除「${title}」嗎？此動作無法復原。`)) return
    // hook 裡的 onSuccess 負責快取；跳頁只有這一頁需要，寫在這裡。兩個都會執行（hook 的先）。
    deleteMutation.mutate(rollId, {
      onSuccess: () => navigate('/film-rolls', { replace: true }),
    })
  }

  return (
    <div className={styles.page}>
      {backLink}

      <div className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        <StatusBadge status={roll.status} />
      </div>

      <dl className={styles.fields}>
        {fields.map(({ label, value }) => (
          <Fragment key={label}>
            <dt className={styles.fieldLabel}>{label}</dt>
            <dd className={styles.fieldValue}>{value}</dd>
          </Fragment>
        ))}
      </dl>

      {updateMutation.error && <ErrorBanner error={updateMutation.error} />}
      <div className={styles.actions}>
        {nextStatuses.map((status) => (
          <button
            key={status}
            type="button"
            className={styles.advanceButton}
            onClick={() => handleAdvance(status)}
            disabled={isBusy}
          >
            推進到：{STATUS_LABELS[status]}
          </button>
        ))}
        <Link to={`/film-rolls/${rollId}/edit`} className={styles.editLink}>
          編輯
        </Link>
      </div>

      {deleteMutation.error && <ErrorBanner error={deleteMutation.error} />}
      <div className={styles.dangerZone}>
        <button
          type="button"
          className={styles.deleteButton}
          onClick={handleDelete}
          disabled={isBusy}
        >
          {deleteMutation.isPending ? '刪除中…' : '刪除這卷'}
        </button>
      </div>

      <p className={styles.meta}>
        建立於 {formatInstant(roll.createdAt)} · 最後更新 {formatInstant(roll.updatedAt)}
      </p>
    </div>
  )
}
