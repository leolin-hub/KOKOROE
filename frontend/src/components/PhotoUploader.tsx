import { useId, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES, formatFileSize } from '../lib/photoUpload'
import type { PhotoUploadQueue, UploadItem } from '../hooks/usePhotoUploadQueue'
import styles from './PhotoUploader.module.css'

interface PhotoUploaderProps {
  queue: PhotoUploadQueue
}

/**
 * 上傳區：拖檔案進來或按按鈕選檔，下面列出每個檔案的進度。
 *
 * 【影響畫面】印樣頁（/film-rolls/:id/photos）最上面那一塊。
 *
 * 選檔用 `<label>` 包住隱藏的 `<input type="file">`：
 * 點 label 等於點 input，不需要用 ref 去呼叫 `input.click()`；鍵盤使用者 Tab 到 input 也能按 Enter 開啟。
 * input 只是「視覺上」藏起來（visually hidden），不是 `display: none`，否則鍵盤和螢幕閱讀器都找不到它。
 */
export default function PhotoUploader({ queue }: PhotoUploaderProps) {
  const inputId = useId()
  const [isDragging, setIsDragging] = useState(false)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { files } = event.target
    if (files) queue.enqueue(files)
    // 清空：不清的話，同一個檔案再選一次不會觸發 change
    event.target.value = ''
  }

  // 拖放：dragover 一定要 preventDefault，瀏覽器才允許在這裡放下；
  // drop 也要 preventDefault，否則瀏覽器會直接打開那張圖片、離開這個網站。
  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(true)
  }

  // 游標移到框裡的文字上時，框本身也會收到 dragleave；
  // 只有真的離開整個框（移到框外的元素）才取消醒目狀態，否則拖曳時框會一閃一閃
  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    const next = event.relatedTarget
    if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
      setIsDragging(false)
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(false)
    queue.enqueue(event.dataTransfer.files)
  }

  const doneCount = queue.items.filter((item) => item.status === 'done').length

  return (
    <section className={styles.uploader} aria-label="上傳照片">
      <input
        id={inputId}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        className={styles.input}
        onChange={handleChange}
      />
      <label
        htmlFor={inputId}
        className={styles.dropZone}
        data-dragging={isDragging || undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className={styles.dropTitle}>把掃描檔拖進來，或按這裡選檔</span>
        <span className={styles.dropHint}>
          JPEG，每張 {MAX_UPLOAD_BYTES / 1024 / 1024} MB 以內。格號從檔名讀（000123_07.jpg → 第 7 格）
        </span>
      </label>

      {queue.items.length > 0 && (
        <div className={styles.queue}>
          <div className={styles.queueHeader}>
            {/* aria-live：上傳進度改變時，螢幕閱讀器會念出來，不用使用者自己去找 */}
            <p className={styles.summary} aria-live="polite">
              {queue.isBusy ? '上傳中' : '上傳完畢'} · 完成 {doneCount} / {queue.items.length}
            </p>
            {doneCount > 0 && (
              <button type="button" className={styles.textButton} onClick={queue.clearFinished}>
                清除已完成
              </button>
            )}
          </div>
          <ul className={styles.list}>
            {queue.items.map((item) => (
              <QueueRow key={item.key} item={item} onRetry={() => queue.retry(item.key)} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function QueueRow({ item, onRetry }: { item: UploadItem; onRetry: () => void }) {
  return (
    <li className={styles.row} data-status={item.status}>
      <span className={styles.fileName}>{item.file.name}</span>
      <span className={styles.fileSize}>{formatFileSize(item.file.size)}</span>
      <span className={styles.status}>
        {item.status === 'queued' && '排隊中'}
        {item.status === 'uploading' && '上傳中…'}
        {item.status === 'done' && `✓ 第 ${item.photo?.frameNumber} 格`}
        {item.status === 'failed' && item.error}
      </span>
      {item.status === 'failed' && item.retryable && (
        <button type="button" className={styles.textButton} onClick={onRetry}>
          重試
        </button>
      )}
    </li>
  )
}
