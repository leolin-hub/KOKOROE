/**
 * 相機 API 契約的 TypeScript 鏡像。
 *
 * 對應 backend/README.md 的「相機（/cameras）」與 `CameraResponse` 章節，
 * 以及 backend/src/main/java/com/kokoroe/camera/dto/。
 */

/**
 * 相機片幅。
 *
 * 比底片規格（`FilmFormat`）多一個半格機：半格機裝的是一般 135 底片，只是每格畫面切成一半。
 */
export type CameraFormat = '135' | '120' | 'half-frame'

export type CameraType = 'POINT_AND_SHOOT' | 'SLR' | 'RANGEFINDER' | 'TLR' | 'DISPOSABLE' | 'OTHER'

export type FocusType = 'AUTO' | 'MANUAL' | 'FIXED' | 'ZONE'

export type FilmAdvance = 'MANUAL' | 'AUTO'

/**
 * `GET /api/v1/cameras` 回傳的相機，對應 `CameraResponse`。
 *
 * 只有 `model`、`format` 必填，其餘規格沒填代表「還不知道」。
 * 後端不輸出 null（`non_null`），所以這些欄位是 optional（`?`）。
 * 注意布林欄位也一樣：`hasFlash` 不存在是「不知道」，`false` 才是「沒有閃光燈」。
 */
export interface CameraResponse {
  id: number
  brand?: string
  model: string
  /** 顯示用名稱（「品牌 型號」），後端已組好 */
  name: string
  format: CameraFormat
  cameraType?: CameraType
  focusType?: FocusType
  filmAdvance?: FilmAdvance
  hasFlash?: boolean
  interchangeableLens?: boolean
  /** 內建鏡頭，例如 `"35mm f/4.5"`；可換鏡頭的機身不會有 */
  fixedLens?: string
  shutterSpeedRange?: string
  isoMin?: number
  isoMax?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

/**
 * 嵌在卷期回應裡的相機摘要，對應 `CameraSummaryResponse`。
 * 完整規格要另外打 `GET /api/v1/cameras/{id}`。
 */
export interface CameraSummary {
  id: number
  name: string
}
