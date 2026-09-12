import { useState } from 'react'
import FieldError from './FieldError'
import { FORMAT_OPTIONS, PUSH_PULL_OPTIONS, STATUS_LABELS, STATUS_ORDER } from '../lib/constants'
import { toDateInputValue } from '../lib/format'
import type { FilmRollStatus, UpdateFilmRollRequest } from '../types/filmRoll'
import styles from './FilmRollForm.module.css'

/**
 * 表單的值型別。
 *
 * 直接取 `UpdateFilmRollRequest`（status 必填）而不是另外定義一份。
 * 好處是：`UpdateFilmRollRequest` 可以直接指派給 `CreateFilmRollRequest`
 * ——後者的 status 是 optional，而 optional 欄位接受「有值」是合法的。
 *
 * 所以同一個表單元件可以同時服務新增與編輯，不需要 generic、
 * 不需要 union，也不需要在元件內寫 `if (mode === 'create')`。
 * 先看懂這個型別關係，再看下面的 props 會輕鬆很多。
 */
export type FilmRollFormValues = UpdateFilmRollRequest

interface FilmRollFormProps {
  /**
   * 表單的初始值。
   *
   * 設為 required 而非 optional 是刻意的：它逼編輯頁先處理好 loading，
   * 不能丟一個 undefined 進來。詳見 FilmRollEditPage 的說明。
   */
  initialValues: FilmRollFormValues
  onSubmit: (values: FilmRollFormValues) => void
  /** 送出中。用來 disable 按鈕，避免連點造成重複送出。 */
  isSubmitting: boolean
  /** 後端 400 回來的欄位錯誤，鍵是欄位名。由 `toFieldErrors()` 產生。 */
  fieldErrors: Record<string, string>
  /** 送出按鈕的文字，例如「建立卷期」/「儲存變更」。 */
  submitLabel: string
  /**
   * 狀態下拉的最低可選值。編輯頁傳入卷期目前的狀態，
   * 讓下拉只列出「目前及之後」的選項 —— 從 UI 層就不可能送出逆向流轉。
   * 新增頁不傳，四個狀態都能選。
   */
  minStatus?: FilmRollStatus
}

/**
 * 新增頁與編輯頁共用的卷期表單。
 *
 * ══════════════════════════════════════════════════
 * TODO(你來寫)：這是整個前端最需要動腦的一支，建議留到最後
 * ══════════════════════════════════════════════════
 *
 * ### 步驟 1：表單狀態
 *
 * ```ts
 * const [values, setValues] = useState<FilmRollFormValues>(initialValues)
 * ```
 *
 * ⚠️ `useState(initialValues)` 的初始值**只在第一次 mount 生效**。
 *    之後 `initialValues` prop 變了，`values` 不會跟著更新。
 *    這不是 bug，是 useState 的設計 —— 它叫「初始值」而不是「值」。
 *    （這就是編輯頁必須等資料到齊才 render 這個元件的原因。）
 *
 * ### 步驟 2：一支通用的 onChange
 *
 * 十個欄位各寫一個 handler 太囉唆。寫一支泛型的：
 *
 * ```ts
 * function setField<K extends keyof FilmRollFormValues>(
 *   key: K,
 *   value: FilmRollFormValues[K],
 * ) {
 *   setValues((prev) => ({ ...prev, [key]: value }))
 * }
 * ```
 *
 * 用 `K extends keyof` 的好處：`setField('iso', 'abc')` 會在編譯期就被擋下來，
 * 因為 TypeScript 知道 `iso` 的型別是 number。
 * 若寫成 `setField(key: string, value: any)` 就完全沒有這層保護了。
 *
 * ⚠️ 一定要用 updater 形式 `setValues(prev => ...)` 而不是
 *    `setValues({ ...values, [key]: value })`。
 *    後者在同一個事件裡連續呼叫兩次時，第二次會用到過期的 `values`
 *    （閉包捕獲的是這次 render 的值），於是第一次的修改被覆蓋掉。
 *
 * ### 步驟 3：欄位（這裡是最容易踩雷的地方）
 *
 * **數字欄位（iso）**
 *
 * `<input type="number">` 的 `e.target.value` 永遠是**字串**。
 * 而且 `Number('')` 是 **0**，不是 NaN，也不是 undefined。
 *
 * 所以如果你寫 `setField('iso', Number(e.target.value))`，
 * 使用者把欄位清空時，iso 會變成 0 而不是「沒有填」。
 * 然後你送出去，後端 `@Positive` 擋下來回你「ISO 必須為正整數」——
 * 但使用者明明看到的是一個空欄位，完全不知道 0 是從哪來的。
 *
 * 這是受控表單最經典的坑。兩種解法：
 *   (a) 另外用一個 `string` state 存輸入中的原始值，送出時才轉數字
 *   (b) 允許 `iso` 暫時為 `'' | number`，送出前檢查
 * (a) 比較乾淨。想一下你要怎麼做，並在這裡寫下決定。
 *
 * **日期欄位（loadedAt / finishedAt）**
 *
 * `<input type="date">` 的 value **必須**是 `YYYY-MM-DD`，
 * 否則瀏覽器會靜默地當成空值（不會有任何警告）。
 * 用 `toDateInputValue()` 轉換，理由見 lib/format.ts。
 *
 * `finishedAt` 是選填的。清空時要送 `undefined` 而不是空字串 ——
 * 空字串會讓後端的 LocalDate 解析失敗（400 malformed-request）。
 * 提示：`setField('finishedAt', e.target.value || undefined)`
 * （`||` 而不是 `??`，因為要把空字串也當成「沒填」）
 *
 * **選填的文字欄位（brand / cameraName / lensName / notes）**
 *
 * 同理，清空時該送 `undefined` 還是 `''`？
 * 後端的 `@Size(max = ...)` 對空字串是合法的，所以兩者都不會報錯。
 * 但語意上「沒填」是 undefined，「填了空白」是 ''。
 * 建議統一成 undefined，讓資料庫裡不要出現一堆空字串。
 *
 * **狀態下拉**
 *
 * ```ts
 * const availableStatuses = minStatus
 *   ? STATUS_ORDER.slice(STATUS_ORDER.indexOf(minStatus))
 *   : STATUS_ORDER
 * ```
 *
 * ### 步驟 4：送出
 *
 * ```tsx
 * <form onSubmit={(e) => { e.preventDefault(); onSubmit(values) }}>
 * ```
 *
 * ⚠️ `e.preventDefault()` 絕對不能忘。沒有它，瀏覽器會用原生方式送出表單
 *    （整頁重新載入），你的 onSubmit 根本來不及執行。
 *    症狀是「按了送出畫面閃一下就回到原樣」，很容易誤判成 API 失敗。
 *
 * 💡 為什麼用 `<form onSubmit>` 而不是在按鈕上寫 `onClick`：
 *    `<form>` 會讓 Enter 鍵在任何輸入框裡都能送出，這是使用者的肌肉記憶。
 *    純 onClick 的版本只能用滑鼠點。這是「免費」的可存取性 —— 用對的元素就有。
 *
 * ### 步驟 5：錯誤與 label 的接線
 *
 * 每個欄位都該是這個樣子：
 *
 * ```tsx
 * <div className={styles.field}>
 *   <label htmlFor="filmName" className={styles.label}>
 *     底片名稱 <span aria-hidden="true">*</span>
 *   </label>
 *   <input
 *     id="filmName"
 *     value={values.filmName}
 *     onChange={(e) => setField('filmName', e.target.value)}
 *     aria-invalid={Boolean(fieldErrors.filmName)}
 *     aria-describedby={fieldErrors.filmName ? 'filmName-error' : undefined}
 *     required
 *   />
 *   <FieldError fieldId="filmName" message={fieldErrors.filmName} />
 * </div>
 * ```
 *
 * 四個必須成立的關聯（少任何一個，鍵盤或螢幕閱讀器使用者就會卡住）：
 *   1. `label` 的 `htmlFor` === `input` 的 `id`
 *      → 點 label 會聚焦到輸入框，螢幕閱讀器讀得出欄位名稱
 *   2. `aria-describedby` === FieldError 產生的 `id`（`{fieldId}-error`）
 *   3. `aria-invalid` 在有錯誤時為 true
 *   4. 沒有錯誤時 `aria-describedby` 要是 `undefined` 而不是空字串
 *      → 指向一個不存在的 id 會讓某些螢幕閱讀器讀出奇怪的東西
 *
 * 💡 `aria-hidden="true"` 包住必填星號：不然螢幕閱讀器會讀成
 *    「底片名稱 星號」。必填的資訊已經由 `required` 屬性傳達了。
 *
 * ### 步驟 6：送出按鈕
 *
 * ```tsx
 * <button type="submit" disabled={isSubmitting}>
 *   {isSubmitting ? '儲存中…' : submitLabel}
 * </button>
 * ```
 *
 * `disabled={isSubmitting}` 不只是體驗問題 ——
 * 沒有它，使用者連點三下就會建立三卷。
 */
export default function FilmRollForm({
  initialValues,
  onSubmit,
  isSubmitting,
  fieldErrors,
  submitLabel,
  minStatus,
}: FilmRollFormProps) {
  const [values, setValues] = useState<FilmRollFormValues>(initialValues)

  throw new Error(
    `TODO: 實作 FilmRollForm（${submitLabel}；目前 ${Object.keys(values).length} 個欄位，` +
      `${Object.keys(fieldErrors).length} 個錯誤，minStatus: ${minStatus ?? '無限制'}，` +
      `submitting: ${isSubmitting}，onSubmit: ${typeof onSubmit}，setValues: ${typeof setValues}）`,
  )
}

/**
 * 新增頁用的空白初始值。
 *
 * TODO(你來寫)：把 `loadedAt` 的預設值填成「今天」。
 *
 * ⚠️ 不要用 `new Date().toISOString().slice(0, 10)`。
 *    `toISOString()` 回的是 **UTC**。在台灣（UTC+8）的凌晨 1 點，
 *    UTC 還是前一天 —— 使用者會看到日期欄位預設成昨天。
 *
 * 正確做法是用本地時區的年月日自己組：
 * ```ts
 * const now = new Date()
 * const today = [
 *   now.getFullYear(),
 *   String(now.getMonth() + 1).padStart(2, '0'),  // getMonth() 是 0-based
 *   String(now.getDate()).padStart(2, '0'),
 * ].join('-')
 * ```
 *
 * `getMonth()` 從 0 開始但 `getDate()` 從 1 開始 —— JS Date API 的著名不一致，
 * 記得 +1。`padStart` 是必要的：`"2026-3-1"` 不是合法的 date input 值。
 *
 * 這支寫成函式而不是常數，是因為「今天」會變。
 * 若寫成 module 層級的常數，開著頁面過午夜就會拿到昨天的日期。
 */
export function emptyFormValues(): FilmRollFormValues {
  throw new Error('TODO: 實作 emptyFormValues')
}
