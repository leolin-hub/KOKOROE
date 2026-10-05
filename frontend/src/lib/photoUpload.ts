import type { PhotoResponse } from '../types/photo'

/**
 * 上傳前在瀏覽器先檢查一次的規則。
 *
 * 後端才是真正的把關者（它看檔頭判斷是不是 JPEG），這裡只是讓明顯不行的檔案不必真的傳上去：
 * 一張 60 MB 的 TIFF 傳完才被拒絕，等於白等。所以這裡的判斷可以寬鬆，不可以比後端嚴格。
 */

/** 和後端 `spring.servlet.multipart.max-file-size: 40MB` 一致（Spring 的 MB 是 1024×1024）。 */
export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024

/** `<input type="file" accept>` 用：選檔視窗只列出 JPEG。 */
export const ACCEPTED_TYPES = 'image/jpeg,.jpg,.jpeg'

/** JPEG 可能出現的副檔名（.jpe、.jfif 是比較少見的寫法）。 */
const JPEG_EXTENSION = /\.(jpe?g|jpe|jfif)$/i
/** JPEG 可能出現的 MIME type（image/pjpeg 是舊版 IE 給的）。 */
const JPEG_TYPES = new Set(['image/jpeg', 'image/pjpeg'])

/**
 * @returns 不能上傳的理由；可以上傳時回 null
 *
 * 只擋「看起來明顯不是 JPEG」的：瀏覽器說了是別的圖片格式、副檔名也不像 JPEG。
 * 瀏覽器認不得（`file.type` 是空字串，例如沒有副檔名的檔案）就放行，交給後端看檔頭判斷。
 */
export function rejectReason(file: File): string | null {
  const looksLikeJpeg =
    JPEG_TYPES.has(file.type) || JPEG_EXTENSION.test(file.name) || file.type === ''
  if (!looksLikeJpeg) {
    return '只接受 JPEG 檔'
  }
  if (file.size === 0) {
    return '檔案是空的'
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `檔案超過 ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`
  }
  return null
}

/**
 * 把剛上傳成功的照片放進已依格號排序的清單，回傳新陣列（不改原本的）。
 * 快取裡的資料是 TanStack Query 在管的，直接 push 會讓它偵測不到變化。
 */
export function insertByFrame(photos: readonly PhotoResponse[], added: PhotoResponse): PhotoResponse[] {
  return [...photos.filter((photo) => photo.id !== added.id), added].sort(
    (a, b) => a.frameNumber - b.frameNumber,
  )
}

/**
 * 檔案大小給人看的寫法：4.8 MB、820 KB。
 *
 * 一律無條件進位：剛好超過 40 MB 的檔案要顯示 40.1 MB，
 * 四捨五入成「40.0 MB」的話，旁邊又寫「檔案超過 40 MB」，看起來互相矛盾。
 */
export function formatFileSize(bytes: number): string {
  const kb = Math.ceil(bytes / 1024)
  if (kb < 1024) {
    return `${kb} KB`
  }
  return `${(Math.ceil((bytes / 1024 / 1024) * 10) / 10).toFixed(1)} MB`
}
