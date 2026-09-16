/**
 * 後端 API 契約 v1 的 TypeScript 鏡像。
 *
 * 對應 backend/README.md 的「API 契約 v1」章節，以及
 * backend/src/main/java/com/kokoroe/filmroll/dto/ 底下的三支 record。
 *
 * 這個檔案是唯一的真相來源 —— 任何元件都不該自己再宣告一份卷期的形狀。
 * 後端契約若有變動，改這裡，然後讓 TypeScript 帶你找出所有壞掉的地方。
 */

import type { CameraSummary } from './camera'

/**
 * 卷期狀態。
 *
 * 用字串聯集而非 TS `enum`：
 * 1. tsconfig 開了 `erasableSyntaxOnly`，`enum` 會編譯失敗（它會產生 runtime 程式碼）。
 * 2. 字串聯集本來就跟 JSON 的值一模一樣，不需要任何轉換層。
 */
export type FilmRollStatus = 'LOADED' | 'SHOOTING' | 'DEVELOPING' | 'ARCHIVED'

/**
 * 底片規格。
 *
 * 注意後端的 Java 常數叫 `FORMAT_135`，但透過 `@JsonValue` 對外的契約是 `"135"`。
 * 前端只需要認得對外契約這一邊。
 */
export type FilmFormat = '135' | '120'

/**
 * `GET` 回傳的卷期表示，對應 `FilmRollResponse`。
 *
 * 後端設了 `default-property-inclusion: non_null`，值為 null 的欄位
 * **不會出現在 JSON 裡**，所以這些欄位標成 optional（`?`）而不是 `| null`。
 * 這個區別很重要：`'brand' in roll` 與 `roll.brand !== null` 在這裡不等價。
 *
 * `pushPullStops` 沒有 `?`：後端在 compact constructor 把 null 正規化成 0，
 * 而 0 不是 null，所以它永遠會出現。
 */
export interface FilmRollResponse {
  id: number
  filmName: string
  brand?: string
  iso: number
  format: FilmFormat
  pushPullStops: number
  /** ISO-8601 日期，例如 `"2026-03-01"`（不是 timestamp，沒有時區） */
  loadedAt: string
  /** 仍在拍攝中時此欄位不存在 */
  finishedAt?: string
  /** 拍這卷的相機；沒指定時此欄位不存在 */
  camera?: CameraSummary
  lensName?: string
  notes?: string
  status: FilmRollStatus
  /** ISO-8601 instant (UTC)，例如 `"2026-03-01T09:12:33.512Z"` */
  createdAt: string
  updatedAt: string
}

/**
 * `POST /api/v1/film-rolls` 的請求 body，對應 `CreateFilmRollRequest`。
 *
 * ⚠️ 後端設了 `fail-on-unknown-properties: true`：送出任何契約裡沒有的欄位
 * 會直接被打回 400。所以**絕對不要**把 `FilmRollResponse` 整包展開後送出
 * （`id` / `createdAt` / `updatedAt` 會讓整個請求失敗）。
 * 這是初學這份 API 最常踩的坑，型別上刻意分開就是為了防這件事。
 */
export interface CreateFilmRollRequest {
  filmName: string
  brand?: string
  iso: number
  format: FilmFormat
  /** -3 ~ 3；不填後端預設 0 */
  pushPullStops?: number
  loadedAt: string
  /** 不得早於 loadedAt，否則 400 business-rule-violated */
  finishedAt?: string
  /**
   * 相機的 id。回應裡是巢狀的 `camera: { id, name }`，請求只送 id。
   * 相機不存在，或相機片幅裝不了這個 `format`，會拿到 400 business-rule-violated。
   */
  cameraId?: number
  lensName?: string
  notes?: string
  /** 不填後端預設 `LOADED` */
  status?: FilmRollStatus
}

/**
 * `PUT /api/v1/film-rolls/{id}` 的請求 body，對應 `UpdateFilmRollRequest`。
 *
 * PUT 是「整份取代」語意：沒帶到的欄位會變成 null，不是「保持原值」。
 * 與 Create 唯一的差異是 `status` 為必填。
 */
export interface UpdateFilmRollRequest {
  filmName: string
  brand?: string
  iso: number
  format: FilmFormat
  pushPullStops?: number
  loadedAt: string
  finishedAt?: string
  cameraId?: number
  lensName?: string
  notes?: string
  /** 必填，且只能向前流轉；逆向會拿到 409 */
  status: FilmRollStatus
}

/**
 * 分頁回應，對應 `common/dto/PageResponse`。
 *
 * 後端刻意不序列化 Spring Data 的 `PageImpl`，而是自訂這個扁平結構，
 * 所以這裡不會有 `pageable` / `numberOfElements` 之類的 Spring 內部欄位。
 */
export interface PageResponse<T> {
  content: T[]
  /** 0-based */
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

/** `GET /api/v1/film-rolls` 的查詢參數。 */
export interface FilmRollListParams {
  /** 不帶則不依狀態篩選 */
  status?: FilmRollStatus
  /** 0-based，預設 0 */
  page?: number
  /** 預設 20，後端上限 100 */
  size?: number
  /** 例如 `'loadedAt,desc'`、`'iso,asc'`；預設 `'loadedAt,desc'` */
  sort?: string
}
