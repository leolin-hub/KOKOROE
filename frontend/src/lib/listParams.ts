import { SORT_OPTIONS, STATUS_ORDER } from './constants'
import type { FilmRollStatus } from '../types/filmRoll'

/*
 * 卷期列表頁與唱片櫃瀏覽頁共用的 URL 參數解析。
 *
 * URL 是使用者可以亂打的外部輸入，讀進來一律先驗證，不合法就退回預設值。
 * 否則 `?status=BANANA` 會原封不動送到後端，換來一個 400。
 * 原本寫在 FilmRollListPage 裡；唱片櫃也要讀同樣的參數，所以抽出來共用。
 */

/** 預設排序：裝片日期新到舊。參數等於預設值時，頁面會把它從 URL 刪掉保持網址乾淨。 */
export const DEFAULT_SORT = 'loadedAt,desc'

export function parseStatus(raw: string | null): FilmRollStatus | undefined {
  return STATUS_ORDER.includes(raw as FilmRollStatus) ? (raw as FilmRollStatus) : undefined
}

export function parseSort(raw: string | null): string {
  return SORT_OPTIONS.some((o) => o.value === raw) ? (raw as string) : DEFAULT_SORT
}
