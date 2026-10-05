/**
 * 照片 API 的 TypeScript 鏡像，對應後端 `photo/dto/PhotoResponse.java`
 * 與 backend/README.md 的「照片」章節。
 */

/**
 * 每張照片在後端存的三個版本，也是圖檔網址的最後一段：`/photos/{id}/{variant}`。
 *
 *   thumb    長邊 480，印樣格狀檢視用
 *   web      長邊 2048，點開放大（lightbox）用
 *   original 上傳的原檔，下載用
 */
export type PhotoVariant = 'thumb' | 'web' | 'original'

/** `GET /film-rolls/{id}/photos` 陣列裡的一筆，也是上傳成功的回應。 */
export interface PhotoResponse {
  id: number
  filmRollId: number
  /** 底片上的格號，0–99。同一卷不重複 */
  frameNumber: number
  /** 上傳時的檔名（已去掉路徑）。上傳時沒有檔名就不會出現 */
  originalFilename?: string
  /** 依 EXIF 轉正後的原圖尺寸，用來算長寬比 */
  width: number
  height: number
  sizeBytes: number
  /** ISO-8601 instant (UTC) */
  createdAt: string
}
