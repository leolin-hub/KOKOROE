import type { CameraFormat, CameraResponse } from '../types/camera'
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
 * 新增頁預先選好的相機：只有一台相機時直接選它，否則不預選。
 *
 * 不寫死「PENTAX PG-50」：相機的 id 在每個資料庫裡都不同，
 * 而且之後開放給朋友用時，每個人的相機也不一樣。
 */
export function defaultCamera(cameras: CameraResponse[] | undefined): CameraResponse | undefined {
  return cameras?.length === 1 ? cameras[0] : undefined
}
