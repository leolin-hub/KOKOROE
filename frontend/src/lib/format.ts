/**
 * 顯示用的格式化工具。純函式，不碰 React，最容易寫單元測試的一層。
 *
 * ── 這個檔案裡藏著整個前端最容易出錯的主題：時區 ──
 *
 * 後端回兩種完全不同的時間型別，必須分開處理：
 *
 *   `loadedAt` / `finishedAt`  → `"2026-03-01"`（LocalDate，**沒有**時區概念）
 *   `createdAt` / `updatedAt`  → `"2026-03-01T09:12:33.512Z"`（Instant，UTC）
 *
 * 「裝片日期」是一個日曆上的日子，不是一個時間點。它不該被時區轉換。
 * 但 `new Date('2026-03-01')` 會被 JS 當成 **UTC 午夜**，
 * 於是在 UTC+8 顯示成 3/1 早上 8 點（還好），在 UTC-5 會顯示成 **2/28**（錯了）。
 * 這就是經典的「日期少一天」bug。
 *
 * 所以：LocalDate 的字串請**當字串處理**，不要丟進 Date。
 */

import { PUSH_PULL_OPTIONS } from './constants'

/** 欄位沒有值時的顯示文字。整個 app 統一用這一個。 */
export const EMPTY_PLACEHOLDER = '—'

/**
 * 格式化 LocalDate 字串：`"2026-03-01"` → `"2026/03/01"`。
 *
 * 只做字串切割，完全不經過 Date，所以不受使用者時區影響。
 */
export function formatDate(value: string | undefined): string {
  if (!value) return EMPTY_PLACEHOLDER
  const [y, m, d] = value.split('-')
  return `${y}/${m}/${d}`
}

/**
 * Instant 是真正的時間點，要經過 Date 轉成使用者當地時間。
 *
 * 在 module 層級建一次 formatter 重複使用，不必每次呼叫都重建。
 * 用 `hourCycle: 'h23'` 而非 `hour12: false`：後者在部分瀏覽器會把午夜顯示成 `24:00`。
 */
const instantFormatter = new Intl.DateTimeFormat('zh-TW', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/**
 * 格式化 Instant 字串：`"2026-03-01T09:12:33.512Z"` → `"2026/03/01 17:12"`（UTC+8）。
 *
 * 只顯示到分鐘。解析失敗時原樣回傳，因為 `format(Invalid Date)` 會丟 RangeError。
 */
export function formatInstant(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return instantFormatter.format(date)
}

/**
 * 格式化增減感格數，例如 `1` → `"推 +1 格"`、`0` → `"標準（不推不減）"`、`-2` → `"減 -2 格"`。
 *
 * 文案直接查 `PUSH_PULL_OPTIONS`，與表單下拉選單共用同一份。
 * 超出 -3 ~ +3 的值理論上不會出現（後端會擋），查不到時仍給一個看得懂的字串。
 */
export function formatPushPull(stops: number): string {
  const label = PUSH_PULL_OPTIONS.find((o) => o.value === stops)?.label
  return label ?? `${stops > 0 ? '+' : ''}${stops} 格`
}

/**
 * 把 LocalDate 轉成 `<input type="date">` 的 `value`。
 *
 * date input 要求 `YYYY-MM-DD`，後端格式剛好一致，所以只需處理 undefined → `''`。
 * controlled input 的 value 不能是 undefined，否則 React 會警告
 * 元件從 uncontrolled 變成 controlled —— 這支函式存在就是為了不讓哪個 input 漏掉。
 */
export function toDateInputValue(value: string | undefined): string {
  return value ?? ''
}

/**
 * 卷期的顯示標題：`"Kodak Portra 400"`，沒有品牌時只有 `"Portra 400"`。
 *
 * 列表卡片與詳情頁共用，確保標題長得一樣。
 * 用 truthy 判斷，空字串 brand 也視為沒有品牌，避免開頭多一個空白。
 */
export function formatRollTitle(filmName: string, brand?: string): string {
  return brand ? `${brand} ${filmName}` : filmName
}
