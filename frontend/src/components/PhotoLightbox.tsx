import { useEffect, useRef } from 'react'
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react'
import { photoUrl } from '../api/photos'
import { formatFileSize } from '../lib/photoUpload'
import ErrorBanner from './ErrorBanner'
import type { PhotoResponse } from '../types/photo'
import styles from './PhotoLightbox.module.css'

interface PhotoLightboxProps {
  photos: readonly PhotoResponse[]
  /** 目前開著第幾張（陣列索引）；null 代表關閉 */
  index: number | null
  onNavigate: (index: number) => void
  onClose: () => void
  onDelete: (photo: PhotoResponse) => void
  isDeleting: boolean
  deleteError: unknown
}

/**
 * 放大檢視一張照片。
 *
 * 【影響畫面】印樣頁點任何一格後蓋在整個畫面上的那一層。
 *
 * 【為什麼用原生 `<dialog>`】
 * `showModal()` 打開的 dialog，瀏覽器會幫忙做好三件麻煩事：
 *   1. 焦點困在 dialog 裡（Tab 不會跑到後面的頁面）
 *   2. 按 Esc 關閉
 *   3. 後面的頁面不能點、螢幕閱讀器也讀不到
 * 自己用 div 做這些要寫一堆程式，而且很容易漏。
 *
 * 【開關怎麼跟 React 同步】
 * dialog 的開關是 DOM 的狀態，要用 `showModal()` / `close()` 這兩個方法，不能用 prop 控制。
 * 規則是「只有一個真相」：開不開由外面傳進來的 `index` 決定（頁面放在網址的 ?photo=），
 * effect 負責把 DOM 對齊它：`index` 有值就打開、null 就關上。
 * 使用者想關（按 ✕、按 Esc、點空白處）時，這裡**不自己關**，只呼叫 `onClose` 請外面把 index 設成 null，
 * 再由 effect 去關。Esc 會觸發 dialog 的 cancel 事件，要 preventDefault 擋掉瀏覽器自己關的預設行為。
 * 若兩邊都能關，刪除照片後「跳到下一張」和「關閉」兩個通知可能先後打架，最後停在錯的地方。
 *
 * 【其他】
 * - 先用已經快取的縮圖（模糊處理）墊底，網頁版（長邊 2048）載完蓋上去：點開瞬間就有畫面，不是一片黑。
 * - 預先載入前後兩張的網頁版，按 ← → 時幾乎不用等。
 * - 點照片以外的地方（dialog 本身）就關閉。
 */
export default function PhotoLightbox({
  photos,
  index,
  onNavigate,
  onClose,
  onDelete,
  isDeleting,
  deleteError,
}: PhotoLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const photo = index === null ? undefined : photos[index]

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (photo && !dialog.open) {
      dialog.showModal()
      // 打開時焦點停在關閉鈕：showModal 預設會停在第一個按鈕，按 Enter 就變成「上一張」。
      // 不能用 React 的 autoFocus：它在元件掛上時就呼叫 focus()，那時 dialog 還沒打開，焦點設不進去。
      closeButtonRef.current?.focus()
    }
    if (!photo && dialog.open) dialog.close()
  }, [photo])

  // 預先載入前後兩張：new Image() 設了 src 瀏覽器就會下載，之後 <img> 用同一個網址直接從快取拿
  useEffect(() => {
    if (index === null) return
    for (const neighbor of [photos[index - 1], photos[index + 1]]) {
      if (neighbor) new Image().src = photoUrl(neighbor.id, 'web')
    }
  }, [index, photos])

  const hasPrev = index !== null && index > 0
  const hasNext = index !== null && index < photos.length - 1

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (index === null) return
    if (event.key === 'ArrowLeft' && hasPrev) onNavigate(index - 1)
    if (event.key === 'ArrowRight' && hasNext) onNavigate(index + 1)
  }

  // 點到照片與按鈕以外的空白處（dialog 本身，或照片周圍的 stage）才關
  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    const target = event.target
    if (target === event.currentTarget || (target instanceof HTMLElement && 'backdrop' in target.dataset)) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      aria-label={photo ? `第 ${photo.frameNumber} 格` : '照片'}
    >
      {photo && index !== null && (
        <>
          {/*
            stage 吃掉資訊列以外的所有空間，照片在裡面置中、依長寬比放到最大。
            它也算「照片以外的空白處」，點了會關閉（見 handleClick）。
          */}
          <div className={styles.stage} data-backdrop="">
            <div
              className={styles.frame}
              style={
                {
                  '--ratio': photo.width / photo.height,
                  '--thumb': `url(${photoUrl(photo.id, 'thumb')})`,
                } as CSSProperties
              }
            >
              {/* key：換張時讓 <img> 重新建立，不會短暫顯示上一張 */}
              <img
                key={photo.id}
                src={photoUrl(photo.id, 'web')}
                alt={`第 ${photo.frameNumber} 格`}
                className={styles.image}
              />
            </div>
          </div>

          <div className={styles.bar}>
            <div className={styles.caption}>
              {/* 只有數字用等寬字，中文用一般字型：等寬字型裡的中文字距很怪 */}
              <span className={styles.frameLabel}>
                第 <span className={styles.frameNumber}>{photo.frameNumber}</span> 格
              </span>
              <span className={styles.meta}>
                {index + 1} / {photos.length}
                {photo.originalFilename && ` · ${photo.originalFilename}`}
                {` · ${photo.width}×${photo.height} · ${formatFileSize(photo.sizeBytes)}`}
              </span>
            </div>

            <div className={styles.actions}>
              {/*
                到頭或到尾時用 aria-disabled 而不是 disabled：
                焦點停在「→」上翻到最後一張時，disabled 的按鈕會讓焦點掉出去，方向鍵也跟著失效。
              */}
              <button
                type="button"
                className={styles.navButton}
                onClick={() => hasPrev && onNavigate(index - 1)}
                aria-disabled={!hasPrev}
                aria-label="上一張"
              >
                ←
              </button>
              <button
                type="button"
                className={styles.navButton}
                onClick={() => hasNext && onNavigate(index + 1)}
                aria-disabled={!hasNext}
                aria-label="下一張"
              >
                →
              </button>
              {/* download 屬性：瀏覽器直接存檔，不在新分頁打開；值是存檔時的預設檔名 */}
              <a
                href={photoUrl(photo.id, 'original')}
                download={photo.originalFilename ?? `frame-${photo.frameNumber}.jpg`}
                className={styles.textAction}
              >
                下載原檔
              </a>
              <span className={styles.divider} aria-hidden="true" />
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => onDelete(photo)}
                disabled={isDeleting}
              >
                {isDeleting ? '刪除中…' : '刪除這張'}
              </button>
              <button
                ref={closeButtonRef}
                type="button"
                className={styles.navButton}
                onClick={onClose}
                aria-label="關閉"
              >
                ✕
              </button>
            </div>
          </div>

          {deleteError != null && (
            <div className={styles.error}>
              <ErrorBanner error={deleteError} />
            </div>
          )}
        </>
      )}
    </dialog>
  )
}
