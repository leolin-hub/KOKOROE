import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { useFilmRoll } from '../hooks/useFilmRoll'
import { usePhotos } from '../hooks/usePhotos'
import { useDeletePhoto } from '../hooks/usePhotoMutations'
import { usePhotoUploadQueue } from '../hooks/usePhotoUploadQueue'
import ContactSheet from '../components/ContactSheet'
import PhotoLightbox from '../components/PhotoLightbox'
import PhotoUploader from '../components/PhotoUploader'
import ErrorBanner from '../components/ErrorBanner'
import { ApiError } from '../api/problem'
import { formatRollTitle } from '../lib/format'
import { FORMAT_OPTIONS } from '../lib/constants'
import type { PhotoResponse } from '../types/photo'
import styles from './FilmRollPhotosPage.module.css'

/**
 * 印樣頁。路由 `/film-rolls/:id/photos`，放大檢視某一張時是 `/film-rolls/:id/photos?photo=12`。
 *
 * 【影響畫面】由上到下：
 *   ← 回到這卷
 *   標題（Kodak Portra 400）＋「印樣 · 24 張 · ISO 400 · 135」
 *   上傳區（拖檔案或選檔，下面列出每個檔案的進度）
 *   印樣（相紙上一條條底片，點一格放大）
 *   放大檢視（lightbox，蓋在最上層）
 *
 * 【幾個刻意的設計】
 * - 正在看哪一張放在網址（`?photo=12`），不放 state：重新整理還停在同一張，網址也能直接傳給別人。
 *   用照片 id 而不是格號或索引：刪掉一張之後，索引會位移，id 不會。
 *   切換張數用 `replace`：不然按 ← → 翻十張，瀏覽紀錄就多十筆，按上一頁要按十次才離開。
 * - 網址的 `?photo=` 指到不存在的照片（被刪了、亂打）就當作沒打開，不顯示錯誤。
 * - 上傳中關分頁會中斷，所以 `isBusy` 時掛 beforeunload，瀏覽器會先問一聲。
 * - 往返連結都把 `location.state` 傳下去：從底片盒一路點進來，最後「回到這卷 → 回到底片盒」還接得上。
 * - 外層用 `key={id}` 包一層：從 /film-rolls/1/photos 直接換到 /2/photos（上一頁、改網址）時，
 *   React Router 會沿用同一個元件，上傳佇列與刪除狀態就會從第 1 卷帶到第 2 卷。
 *   key 一換，React 會把整個元件丟掉重建，state 全部從頭開始。
 */
export default function FilmRollPhotosPage() {
  const { id } = useParams<{ id: string }>()
  return <RollPhotos key={id} rollId={Number(id)} />
}

function RollPhotos({ rollId }: { rollId: number }) {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: roll, isPending, error, refetch } = useFilmRoll(rollId)
  const photosQuery = usePhotos(rollId)
  const queue = usePhotoUploadQueue(rollId)
  const deleteMutation = useDeletePhoto()

  useEffect(() => {
    if (!queue.isBusy) return
    // 現代瀏覽器不顯示自訂文字，只要呼叫 preventDefault 就會跳出「確定要離開嗎？」
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [queue.isBusy])

  const backLink = (
    <Link to={`/film-rolls/${rollId}`} state={location.state} className={styles.back}>
      ← 回到這卷
    </Link>
  )

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

  if (isPending) {
    return renderMessage(<p className={styles.message}>載入中…</p>)
  }

  // 用「有沒有資料」判斷，而不是 isError：背景重抓失敗時 isError 也是 true，但手上的卷期資料還能用，
  // 不該因此把整頁（連同上傳中的佇列與印樣）換成錯誤訊息。走到這裡還沒有資料，就只剩錯誤一種可能
  if (!roll) {
    return renderMessage(
      error instanceof ApiError && error.status === 404 ? (
        <p className={styles.message}>這卷不存在，可能已被刪除。</p>
      ) : (
        <ErrorBanner error={error} onRetry={() => void refetch()} />
      ),
    )
  }

  const title = formatRollTitle(roll.filmName, roll.brand)
  const photos = photosQuery.data ?? []
  const openId = Number(searchParams.get('photo'))
  const openIndex = photos.findIndex((photo) => photo.id === openId)
  // 先取出來：下面的函式裡 TypeScript 會忘記 roll 已經確認過有值（同詳情頁的 baseRequest）
  const format = roll.format
  const formatLabel = FORMAT_OPTIONS.find((o) => o.value === format)?.label ?? format

  /** 打開某一張；傳 null 關閉。 */
  function showPhoto(photo: PhotoResponse | null) {
    // 換張就清掉上一張的刪除錯誤。刪除還在進行時不清：清了「刪除中…」會消失，按鈕又能再按一次
    if (!deleteMutation.isPending) deleteMutation.reset()
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (photo) next.set('photo', String(photo.id))
        else next.delete('photo')
        return next
      },
      { replace: true, state: location.state },
    )
  }

  function handleDelete(photo: PhotoResponse) {
    if (!window.confirm(`確定要刪除第 ${photo.frameNumber} 格嗎？原檔也會一起刪除，無法復原。`)) return
    // 刪掉之後停在下一張；刪的是最後一張就往前一張；全刪光就關掉
    const neighbor = photos[openIndex + 1] ?? photos[openIndex - 1] ?? null
    deleteMutation.mutate(
      { photoId: photo.id, rollId },
      { onSuccess: () => showPhoto(neighbor) },
    )
  }

  function renderSheet() {
    if (photosQuery.isPending) {
      return <p className={styles.message}>載入照片中…</p>
    }
    // 只有「完全沒資料」時才整塊換成錯誤。背景重抓失敗時 isError 也是 true，
    // 但手上的舊資料還能用，不該把整張印樣換成錯誤訊息
    if (photosQuery.isError && !photosQuery.data) {
      return <ErrorBanner error={photosQuery.error} onRetry={() => void photosQuery.refetch()} />
    }
    if (photos.length === 0) {
      return (
        <p className={styles.empty}>
          還沒有照片。把沖印店給的 JPEG 拖進上面的框，或按一下框框選檔。
        </p>
      )
    }
    return (
      <ContactSheet
        photos={photos}
        format={format}
        edgeLabel={title}
        onOpen={showPhoto}
      />
    )
  }

  return (
    <div className={styles.page}>
      {backLink}

      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>
          {/* 張數等照片清單到了才顯示：載入中或載入失敗時寫「0 張」會誤導 */}
          印樣{photosQuery.data && ` · ${photos.length} 張`} · ISO {roll.iso} · {formatLabel}
        </p>
      </header>

      <PhotoUploader queue={queue} />

      {renderSheet()}

      <PhotoLightbox
        photos={photos}
        index={openIndex >= 0 ? openIndex : null}
        onNavigate={(index) => showPhoto(photos[index])}
        onClose={() => showPhoto(null)}
        onDelete={handleDelete}
        isDeleting={deleteMutation.isPending}
        deleteError={deleteMutation.error}
      />
    </div>
  )
}
