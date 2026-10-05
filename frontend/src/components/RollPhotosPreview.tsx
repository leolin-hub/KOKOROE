import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { photoUrl } from '../api/photos'
import { usePhotos } from '../hooks/usePhotos'
import styles from './RollPhotosPreview.module.css'

/** 詳情頁上最多預覽幾張：剛好一條 135 底片 */
const PREVIEW_COUNT = 6

interface RollPhotosPreviewProps {
  rollId: number
  /** 原封不動傳給往印樣頁的連結，讓「回到底片盒」接得上（見 lib/backLink.ts） */
  linkState: unknown
}

/**
 * 詳情頁的「照片」區塊：前幾張縮圖排成一條，加上去印樣頁的入口。
 *
 * 【影響畫面】卷期詳情頁，欄位清單下面。
 *
 * 照片清單載入失敗時只顯示一行小字，不用 ErrorBanner：
 * 這是詳情頁的附屬區塊，失敗了不該搶走整頁的注意力，點進印樣頁會有完整的錯誤與重試。
 */
export default function RollPhotosPreview({ rollId, linkState }: RollPhotosPreviewProps) {
  const { data: photos, isPending, isError } = usePhotos(rollId)
  const sheetPath = `/film-rolls/${rollId}/photos`

  let body: ReactNode
  if (isPending) {
    body = <p className={styles.note}>載入照片中…</p>
  } else if (isError && !photos) {
    body = <p className={styles.note}>照片暫時載入不了。</p>
  } else if (photos.length === 0) {
    body = <p className={styles.note}>還沒有照片。</p>
  } else {
    body = (
      <ul className={styles.strip}>
        {photos.slice(0, PREVIEW_COUNT).map((photo) => (
          <li key={photo.id} className={styles.frame}>
            <Link
              to={`${sheetPath}?photo=${photo.id}`}
              state={linkState}
              className={styles.frameLink}
              aria-label={`第 ${photo.frameNumber} 格，放大檢視`}
            >
              <img src={photoUrl(photo.id, 'thumb')} alt="" loading="lazy" className={styles.image} />
            </Link>
          </li>
        ))}
      </ul>
    )
  }

  const hasPhotos = Boolean(photos?.length)

  return (
    <section className={styles.section} aria-labelledby="roll-photos-heading">
      <div className={styles.header}>
        <h2 id="roll-photos-heading" className={styles.heading}>
          照片{hasPhotos && <span className={styles.count}>{photos?.length} 張</span>}
        </h2>
        <Link to={sheetPath} state={linkState} className={styles.sheetLink}>
          {hasPhotos ? '打開印樣 →' : '上傳掃描檔 →'}
        </Link>
      </div>
      {body}
    </section>
  )
}
