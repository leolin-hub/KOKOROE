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
 * 新增頁與編輯頁共用的卷期表單。write path 裡最大的一支。
 *
 * 【影響畫面】
 *   - /film-rolls/new（裝新的一卷）：空白表單，按「建立卷期」
 *   - /film-rolls/:id/edit（編輯卷期）：帶入這卷目前的資料，按「儲存變更」
 *   整個表單的輸入框、下拉選單、送出按鈕都在這支元件裡；
 *   頁面只負責「送出後要做什麼」（呼叫 API、跳頁）。
 *
 * 【會用到】
 *   - useState                               react（已 import）
 *   - FieldError                             每個欄位下方的錯誤訊息（已 import）
 *   - FORMAT_OPTIONS、PUSH_PULL_OPTIONS      規格、增減感下拉的選項（已 import）
 *   - STATUS_ORDER、STATUS_LABELS            狀態下拉的選項與中文（已 import）
 *   - toDateInputValue(value)                日期欄位的 value（lib/format.ts，已 import）
 *   - styles.form / field / label / required / row / hint / textarea / actions / submit / cancel
 *   - 要自己補的 import：
 *       `FilmFormat` 型別 → 加到 `import type { FilmRollStatus, ... } from '../types/filmRoll'` 那行
 *       `FormEvent` 型別  → `import type { FormEvent } from 'react'`
 *
 * 【欄位清單】（* 為必填）
 *   filmName*      文字      <input>
 *   brand          文字      <input>          清空要存 undefined
 *   iso*           數字      <input type="number">  見步驟 3 的 ISO 說明
 *   format*        下拉      <select>         選項 FORMAT_OPTIONS
 *   pushPullStops  下拉      <select>         選項 PUSH_PULL_OPTIONS
 *   loadedAt*      日期      <input type="date">
 *   finishedAt     日期      <input type="date">    清空要存 undefined；還在拍就留空
 *   cameraName     文字      <input>          清空要存 undefined
 *   lensName       文字      <input>          清空要存 undefined
 *   notes          長文字    <textarea>       清空要存 undefined
 *   status*        下拉      <select>         選項見步驟 4
 *
 * ══════════════════════════════════════════════════
 * 步驟 1：表單狀態
 * ══════════════════════════════════════════════════
 *
 * 已經寫好的一行：
 * `const [values, setValues] = useState<FilmRollFormValues>(initialValues)`
 *
 * 再加一個 ISO 專用的「字串」state（原因見步驟 3）：
 * `const [isoInput, setIsoInput] = useState(String(initialValues.iso))`
 *
 * ⚠️ useState 的初始值只在元件第一次出現時採用。之後 initialValues 變了，values 也不會跟著變。
 *    所以編輯頁必須等資料載入完才 render 這個表單。
 *
 * ══════════════════════════════════════════════════
 * 步驟 2：一支通用的 setField，十個欄位共用
 * ══════════════════════════════════════════════════
 *
 * ```ts
 * function setField<K extends keyof FilmRollFormValues>(key: K, value: FilmRollFormValues[K]) {
 *   setValues((prev) => ({ ...prev, [key]: value }))
 * }
 * ```
 *
 * - `K extends keyof`：寫錯型別會被擋下來，例如 `setField('iso', 'abc')` 直接編譯錯誤。
 * - 用 `prev => ...` 而不是 `{ ...values, [key]: value }`：
 *   同一個事件連續改兩個欄位時，後者用的是舊的 values，會把前一次的修改蓋掉。
 *
 * ══════════════════════════════════════════════════
 * 步驟 3：每種欄位的 value / onChange 寫法（e 是事件物件）
 * ══════════════════════════════════════════════════
 *
 * 必填文字（filmName）
 *   value={values.filmName}
 *   onChange={(e) => setField('filmName', e.target.value)}
 *
 * 選填文字（brand / cameraName / lensName / notes）
 *   value={values.brand ?? ''}
 *   onChange={(e) => setField('brand', e.target.value || undefined)}
 *
 * ISO
 *   value={isoInput}
 *   onChange={(e) => setIsoInput(e.target.value)}
 *   再加上屬性：type="number" required min={1} max={12800} step={1}
 *
 * 規格下拉（format）
 *   value={values.format}
 *   onChange={(e) => setField('format', e.target.value as FilmFormat)}
 *   選項：FORMAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
 *
 * 增減感下拉（pushPullStops）
 *   value={values.pushPullStops ?? 0}
 *   onChange={(e) => setField('pushPullStops', Number(e.target.value))}
 *   選項：PUSH_PULL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
 *
 * 必填日期（loadedAt）
 *   value={toDateInputValue(values.loadedAt)}
 *   onChange={(e) => setField('loadedAt', e.target.value)}
 *
 * 選填日期（finishedAt）
 *   value={toDateInputValue(values.finishedAt)}
 *   onChange={(e) => setField('finishedAt', e.target.value || undefined)}
 *   下面可以放一行提示：<p className={styles.hint}>還在拍的話留空</p>
 *
 * 【為什麼 ISO 要另外存字串】
 *   `<input type="number">` 的 e.target.value 永遠是字串，而 `Number('')` 是 0。
 *   如果直接寫 `setField('iso', Number(e.target.value))`，使用者清空欄位時 iso 會變成 0，
 *   送出後後端回「ISO 感光度必須為正整數」，但使用者看到的明明是空欄位。
 *   所以輸入中存字串，送出時才轉成數字（步驟 5）；
 *   `required min={1}` 讓瀏覽器在欄位空白或小於 1 時直接擋下送出。
 *
 * 【為什麼選填欄位用 `|| undefined`】
 *   清空欄位時 e.target.value 是 `''`。空字串送到後端：日期會解析失敗（400），
 *   文字則會在資料庫裡存一堆空字串。`||` 會把 '' 當成沒填，`??` 不會。
 *
 * 【為什麼 value 要寫 `?? ''`】
 *   React 的 input value 不能是 undefined，否則 console 會警告
 *   「元件從 uncontrolled 變成 controlled」。
 *
 * ══════════════════════════════════════════════════
 * 步驟 4：狀態下拉只列出可以選的狀態
 * ══════════════════════════════════════════════════
 *
 * ```ts
 * const availableStatuses = minStatus
 *   ? STATUS_ORDER.slice(STATUS_ORDER.indexOf(minStatus))
 *   : STATUS_ORDER
 * ```
 *
 *   value={values.status}
 *   onChange={(e) => setField('status', e.target.value as FilmRollStatus)}
 *   選項：availableStatuses.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)
 *
 * 編輯頁會把目前狀態傳進 minStatus，使用者就選不到比現在更早的狀態（後端會回 409）。
 *
 * ══════════════════════════════════════════════════
 * 步驟 5：送出
 * ══════════════════════════════════════════════════
 *
 * ```tsx
 * function handleSubmit(e: FormEvent<HTMLFormElement>) {
 *   e.preventDefault()
 *   onSubmit({ ...values, iso: Number(isoInput) })
 * }
 *
 * return (
 *   <form className={styles.form} onSubmit={handleSubmit}>
 *     ...所有欄位（步驟 6）...
 *     ...按鈕列（步驟 7）...
 *   </form>
 * )
 * ```
 *
 * - `e.preventDefault()` 一定要寫：少了它瀏覽器會整頁重新載入，畫面閃一下就回到原樣，
 *   很容易誤以為是 API 失敗。
 * - 用 `<form onSubmit>` 而不是在按鈕上寫 onClick：在任何輸入框按 Enter 都能送出。
 *
 * ══════════════════════════════════════════════════
 * 步驟 6：一個欄位的完整樣子（其他欄位照這個改名字）
 * ══════════════════════════════════════════════════
 *
 * ```tsx
 * <div className={styles.field}>
 *   <label htmlFor="filmName" className={styles.label}>
 *     底片名稱 <span className={styles.required} aria-hidden="true">*</span>
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
 * - label 的 `htmlFor` 要等於 input 的 `id`：點 label 會跳到輸入框，螢幕閱讀器也讀得出欄位名稱。
 * - `aria-describedby` 要等於 FieldError 產生的 id（`欄位名-error`）；沒有錯誤時給 undefined，不要給空字串。
 * - 必填星號包 `aria-hidden="true"`：螢幕閱讀器才不會念出「星號」，必填已經由 `required` 表達。
 * - 想讓兩個欄位並排（例如 ISO 和規格），外面再包一層 `<div className={styles.row}>`。
 * - notes 用 `<textarea className={styles.textarea}>`，寫法和選填文字一樣。
 *
 * ══════════════════════════════════════════════════
 * 步驟 7：按鈕列
 * ══════════════════════════════════════════════════
 *
 * ```tsx
 * <div className={styles.actions}>
 *   <button type="submit" className={styles.submit} disabled={isSubmitting}>
 *     {isSubmitting ? '儲存中…' : submitLabel}
 *   </button>
 * </div>
 * ```
 *
 * `disabled={isSubmitting}` 防止連點：沒有它，連點三下就會建立三卷。
 *
 * 想加「取消」按鈕的話：用 `useNavigate()`（react-router）拿到 navigate，
 * `<button type="button" className={styles.cancel} onClick={() => navigate(-1)}>取消</button>`。
 * `type="button"` 一定要寫，否則 form 裡的按鈕預設是 submit，按取消也會送出表單。
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
 * 新增頁表單一打開時的預設值。
 *
 * 【影響畫面】/film-rolls/new 打開時，各欄位預先填好的內容。
 *
 * 【會用到】`new Date()` 的 getFullYear() / getMonth() / getDate()、字串的 padStart()
 *
 * 【步驟】
 * 1. 組出「今天」的 YYYY-MM-DD（用本地時區）：
 *    ```ts
 *    const now = new Date()
 *    const today = [
 *      now.getFullYear(),
 *      String(now.getMonth() + 1).padStart(2, '0'),   // getMonth() 從 0 開始，要 +1
 *      String(now.getDate()).padStart(2, '0'),
 *    ].join('-')
 *    ```
 *
 * 2. 回傳完整的 FilmRollFormValues：
 *    ```ts
 *    return {
 *      filmName: '',
 *      iso: 400,               // PG-50 的 DX code 範圍是 100–400，預設 400
 *      format: '135',
 *      pushPullStops: 0,
 *      loadedAt: today,
 *      cameraName: 'PENTAX PG-50',   // 你的相機固定是這台，預先填好省得每次打
 *      lensName: '35mm f/4.5',
 *      status: 'LOADED',
 *    }
 *    ```
 *    brand、finishedAt、notes 是選填，不寫就是 undefined。
 *
 * ⚠️ 不要用 `new Date().toISOString().slice(0, 10)`：toISOString 是 UTC 時間，
 *    台灣凌晨 0～8 點時會拿到昨天的日期。
 * ⚠️ `padStart` 不能省：`2026-9-5` 不是合法的 date input 值，欄位會一片空白且沒有任何警告。
 *
 * 寫成函式而不是常數，是因為「今天」會變：寫成常數的話，頁面開著過了午夜就會是昨天。
 */
export function emptyFormValues(): FilmRollFormValues {
  throw new Error('TODO: 實作 emptyFormValues')
}
