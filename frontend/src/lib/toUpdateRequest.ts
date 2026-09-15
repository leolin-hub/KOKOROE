import type { FilmRollResponse, UpdateFilmRollRequest } from '../types/filmRoll'

/**
 * 把後端回傳的卷期轉成 PUT 請求的 body。
 *
 * 詳情頁推進狀態、編輯頁的表單初始值都需要這個轉換。
 *
 * 逐一列出欄位而不是 `{ ...roll }`：展開會把 id、createdAt、updatedAt 一起帶出去，
 * 後端設了 fail-on-unknown-properties，整個請求會直接被打回 400。
 * 之後契約新增欄位時，TypeScript 會在這裡提醒你補上（UpdateFilmRollRequest 的必填欄位少了會編譯失敗）。
 */
export function toUpdateRequest(roll: FilmRollResponse): UpdateFilmRollRequest {
  return {
    filmName: roll.filmName,
    brand: roll.brand,
    iso: roll.iso,
    format: roll.format,
    pushPullStops: roll.pushPullStops,
    loadedAt: roll.loadedAt,
    finishedAt: roll.finishedAt,
    cameraName: roll.cameraName,
    lensName: roll.lensName,
    notes: roll.notes,
    status: roll.status,
  }
}
