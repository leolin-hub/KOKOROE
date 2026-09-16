import type { CameraFormat } from '../types/camera'
import type { FilmFormat, FilmRollStatus } from '../types/filmRoll'

/**
 * UI 用的常數表。
 *
 * 所有「狀態機器碼 → 中文顯示」的對應只能在這裡。
 * 散在各元件裡的話，某天要改文案就得全專案搜尋，而且一定會漏一個。
 */

/** 狀態的顯示文字。 */
export const STATUS_LABELS: Record<FilmRollStatus, string> = {
  LOADED: '已裝片',
  SHOOTING: '拍攝中',
  DEVELOPING: '沖洗中',
  ARCHIVED: '已歸檔',
}

/**
 * 狀態的流程順序，與後端 `FilmRollStatus` 的 sequence 一致。
 *
 * 陣列順序本身就是語意（索引 = sequence），所以請維持這個順序。
 * 下拉選單、進度條都該依這個順序呈現。
 */
export const STATUS_ORDER: readonly FilmRollStatus[] = [
  'LOADED',
  'SHOOTING',
  'DEVELOPING',
  'ARCHIVED',
]

/** 底片規格選項。value 是 API 契約的值，label 是給人看的。 */
export const FORMAT_OPTIONS: readonly { value: FilmFormat; label: string }[] = [
  { value: '135', label: '135（35mm）' },
  { value: '120', label: '120（中片幅）' },
]

/** 相機片幅的顯示文字。 */
export const CAMERA_FORMAT_LABELS: Record<CameraFormat, string> = {
  '135': '135',
  '120': '120',
  'half-frame': '半格',
}

/**
 * 增減感的選項，-3 ~ +3。
 *
 * 用 `Array.from` 生成而非手寫七個：範圍改了只要改一個數字。
 * 但注意這是 module 層級的一次性計算，不是每次 render 都跑。
 */
export const PUSH_PULL_OPTIONS: readonly { value: number; label: string }[] = Array.from(
  { length: 7 },
  (_, i) => {
    const stops = i - 3
    if (stops === 0) return { value: 0, label: '標準（不推不減）' }
    return {
      value: stops,
      label: stops > 0 ? `推 +${stops} 格` : `減 ${stops} 格`,
    }
  },
)

/** 後端允許的每頁筆數上限（`spring.data.web.pageable.max-page-size`）。 */
export const MAX_PAGE_SIZE = 100

/** 預設每頁筆數，與後端 `@PageableDefault` 一致。 */
export const DEFAULT_PAGE_SIZE = 20

/** 排序選項。字串格式是 Spring Data 的 `屬性,方向`。 */
export const SORT_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'loadedAt,desc', label: '裝片日期（新到舊）' },
  { value: 'loadedAt,asc', label: '裝片日期（舊到新）' },
  { value: 'iso,desc', label: 'ISO（高到低）' },
  { value: 'iso,asc', label: 'ISO（低到高）' },
  { value: 'filmName,asc', label: '底片名稱（A→Z）' },
]
