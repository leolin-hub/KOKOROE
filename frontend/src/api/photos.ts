import { apiUrl, http } from './http'
import type { PhotoResponse, PhotoVariant } from '../types/photo'

/**
 * 照片 API 的呼叫函式。和 `filmRolls.ts` 一樣不含任何 React。
 *
 * 路徑分兩種（後端的設計）：
 *   /film-rolls/{rollId}/photos   列出、上傳：照片屬於某一卷
 *   /photos/{id}                  單張的讀取、刪除：照片有自己的 id，不必再帶卷期
 */

/** 這一卷的所有照片，依格號排序。不分頁（一卷最多 100 張）。 */
export function listPhotos(rollId: number): Promise<PhotoResponse[]> {
  return http.get<PhotoResponse[]>(`/film-rolls/${rollId}/photos`)
}

/**
 * 上傳一張照片。格號由後端從檔名推（`000123_07.jpg` → 第 7 格），推不出就接在最後。
 *
 * 欄位名必須是 `file`，對應後端的 `@RequestParam MultipartFile file`。
 * `FormData.append` 的第三個參數是檔名：File 本身就帶著名字，這裡明確傳是為了讓意圖清楚。
 */
export function uploadPhoto(rollId: number, file: File, signal?: AbortSignal): Promise<PhotoResponse> {
  const form = new FormData()
  form.append('file', file, file.name)
  return http.postForm<PhotoResponse>(`/film-rolls/${rollId}/photos`, form, signal)
}

export function deletePhoto(id: number): Promise<void> {
  return http.delete(`/photos/${id}`)
}

/**
 * 圖檔網址，直接放進 `<img src>`。
 *
 * 不經過 fetch：交給瀏覽器自己載入，才能享受 lazy loading 與快取。
 * 後端回 `Cache-Control: immutable`，同一張照片載過一次就不會再下載。
 */
export function photoUrl(id: number, variant: PhotoVariant): string {
  return apiUrl(`/photos/${id}/${variant}`)
}
