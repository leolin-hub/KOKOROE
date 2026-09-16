import type { CameraFormat, CameraResponse, UpdateCameraRequest } from '../types/camera'
import type { FilmFormat } from '../types/filmRoll'

/**
 * 每種相機片幅能裝的底片規格，與後端 `CameraFormat.accepts()` 一致。
 * 半格機裝的是 135 底片。
 */
const FILM_FORMAT_BY_CAMERA: Record<CameraFormat, FilmFormat> = {
  '135': '135',
  '120': '120',
  'half-frame': '135',
}

/** 這台相機能不能裝這個規格的底片。 */
export function cameraAcceptsFilm(camera: CameraResponse, format: FilmFormat): boolean {
  return FILM_FORMAT_BY_CAMERA[camera.format] === format
}

/**
 * 新增相機頁的預設值：只有必填的型號（空白）與片幅（135）。
 *
 * 放在這裡而不是 CameraForm.tsx：元件檔只 export 元件，Vite 的 Fast Refresh 才能在改樣式時保留表單狀態
 * （oxlint 的 `only-export-components` 警告就是在提醒這件事）。
 */
export function emptyCameraValues(): UpdateCameraRequest {
  return { model: '', format: '135' }
}

/**
 * 把後端回傳的相機轉成 PUT 請求的 body（編輯頁表單的初始值）。
 * 逐一列出欄位的理由同 `toUpdateRequest`：展開會帶出 id、name、createdAt，被後端打回 400。
 */
export function toCameraRequest(camera: CameraResponse): UpdateCameraRequest {
  return {
    brand: camera.brand,
    model: camera.model,
    format: camera.format,
    cameraType: camera.cameraType,
    focusType: camera.focusType,
    filmAdvance: camera.filmAdvance,
    hasFlash: camera.hasFlash,
    interchangeableLens: camera.interchangeableLens,
    fixedLens: camera.fixedLens,
    shutterSpeedRange: camera.shutterSpeedRange,
    isoMin: camera.isoMin,
    isoMax: camera.isoMax,
    notes: camera.notes,
  }
}

/**
 * 新增頁預先選好的相機：只有一台相機時直接選它，否則不預選。
 *
 * 不寫死「PENTAX PG-50」：相機的 id 在每個資料庫裡都不同，
 * 而且之後開放給朋友用時，每個人的相機也不一樣。
 */
export function defaultCamera(cameras: CameraResponse[] | undefined): CameraResponse | undefined {
  return cameras?.length === 1 ? cameras[0] : undefined
}
