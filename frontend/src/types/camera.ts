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
 * `POST /api/v1/cameras` 的請求 body，對應 `CreateCameraRequest`。
 *
 * 和卷期一樣，後端設了 `fail-on-unknown-properties`：不能把 `CameraResponse` 整包送回去
 * （`id`、`name`、`createdAt` 會讓請求被打回 400），要用 `toCameraRequest()` 轉換。
 * 品牌與型號同名（不分大小寫）已存在時回 409。
 */
export interface CreateCameraRequest {
  brand?: string
  model: string
  format: CameraFormat
  cameraType?: CameraType
  focusType?: FocusType
  filmAdvance?: FilmAdvance
  hasFlash?: boolean
  /** 為 `true` 時不可填 `fixedLens`，否則 400 business-rule-violated */
  interchangeableLens?: boolean
  fixedLens?: string
  shutterSpeedRange?: string
  /** 1 ~ 12800，且不可大於 `isoMax` */
  isoMin?: number
  isoMax?: number
  notes?: string
}

/**
 * `PUT /api/v1/cameras/{id}` 的請求 body，對應 `UpdateCameraRequest`。
 *
 * 目前欄位與新增完全相同。PUT 是整份取代：沒帶的規格會被清成「不知道」。
 * 還有卷期使用時，改成裝不下這些底片的片幅會拿到 409。
 */
export type UpdateCameraRequest = CreateCameraRequest

/**
 * 嵌在卷期回應裡的相機摘要，對應 `CameraSummaryResponse`。
 * 完整規格要另外打 `GET /api/v1/cameras/{id}`。
 */
export interface CameraSummary {
  id: number
  name: string
}
