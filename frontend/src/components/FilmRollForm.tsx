import { useState } from 'react'
import type { SubmitEvent } from 'react'
import Field from './FormField'
import { useCameras } from '../hooks/useCameras'
import { cameraAcceptsFilm } from '../lib/camera'
import {
  CAMERA_FORMAT_LABELS,
  FORMAT_OPTIONS,
  PUSH_PULL_OPTIONS,
  STATUS_LABELS,
  STATUS_ORDER,
} from '../lib/constants'
import { toDateInputValue } from '../lib/format'
import type { CameraResponse } from '../types/camera'
import type { FilmFormat, FilmRollStatus, UpdateFilmRollRequest } from '../types/filmRoll'
import styles from './Form.module.css'

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
 * 新增頁與編輯頁共用的卷期表單。
 *
 * 【影響畫面】
 *   - /film-rolls/new（裝新的一卷）：預設值來自 `emptyFormValues()`，按「建立卷期」
 *   - /film-rolls/:id/edit（編輯卷期）：帶入這卷目前的資料，按「儲存變更」
 *   頁面只負責送出後要做什麼（呼叫 API、跳頁），欄位與狀態都在這裡。
 *
 * 【幾個刻意的設計】
 * - useState 的初始值只在第一次 mount 時採用，之後 `initialValues` 變了也不會跟著變。
 *   所以編輯頁必須等資料載入完才 render 這個表單。
 * - ISO 另外用字串 state 存：`<input type="number">` 的值是字串，而 `Number('')` 是 0。
 *   直接轉數字的話，清空欄位會變成送出 0。送出時才轉，空白與範圍交給瀏覽器的 required / min 擋。
 * - 選填欄位清空時存 `undefined` 而不是 `''`：空字串的日期後端會解析失敗，文字則會在資料庫留下空字串。
 *   `|| undefined` 會把 '' 當成沒填，`??` 不會。
 * - controlled input 的 value 不能是 undefined（React 會警告 uncontrolled → controlled），
 *   所以選填欄位的 value 寫 `?? ''`，日期用 `toDateInputValue()`。
 * - `maxLength` / `min` / `max` 與後端的 Bean Validation 上限一致，大部分錯誤在送出前就被瀏覽器擋下。
 *   後端的檢查依然存在，這裡只是讓使用者不用等一趟來回。
 * - 狀態下拉只列出 `minStatus` 及之後的狀態，UI 上選不到會被後端 409 擋下的倒退選項。
 * - 相機下拉的選項來自 `useCameras()`。裝不了目前底片規格的相機（例如選 135 時的 120 相機）
 *   會顯示但設為 disabled，同理是讓 UI 選不到會被後端 400 擋下的組合。
 *   已經選好相機後才改規格，仍可能變成不相容，所以另外用提示文字說明，送出後由後端擋下。
 * - `<select>` 的 value 一定是字串，`cameraId` 是數字：讀的時候 `?? ''`，寫的時候轉回數字，
 *   選「不指定」（value 為 ''）時存 undefined。
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
  const [isoInput, setIsoInput] = useState(String(initialValues.iso))

  const camerasQuery = useCameras()
  const cameras = camerasQuery.data ?? []
  const selectedCamera = cameras.find((c) => c.id === values.cameraId)

  const availableStatuses = minStatus
    ? STATUS_ORDER.slice(STATUS_ORDER.indexOf(minStatus))
    : STATUS_ORDER

  let cameraHint: string | undefined
  if (camerasQuery.isError) {
    cameraHint = '相機清單載入失敗，請重新整理頁面'
  } else if (camerasQuery.isSuccess && cameras.length === 0) {
    cameraHint = '還沒有建立任何相機，可以到上方的「相機」頁新增'
  } else if (selectedCamera && !cameraAcceptsFilm(selectedCamera, values.format)) {
    cameraHint = `這台相機是${CAMERA_FORMAT_LABELS[selectedCamera.format]}片幅，裝不了 ${values.format} 底片`
  }

  /**
   * 通用的欄位更新。`K extends keyof` 讓 `setField('iso', 'abc')` 在編譯期就被擋下。
   * 用 updater 形式：同一個事件連續改兩個欄位時，才不會用到過期的 values 而蓋掉前一次修改。
   */
  function setField<K extends keyof FilmRollFormValues>(key: K, value: FilmRollFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  /** 有錯誤的欄位標上 aria-invalid，並指向 FieldError 產生的 id（`欄位名-error`）。 */
  function errorProps(name: keyof FilmRollFormValues) {
    const message = fieldErrors[name]
    return {
      'aria-invalid': Boolean(message),
      'aria-describedby': message ? `${name}-error` : undefined,
    }
  }

  /**
   * 換相機。定焦機的鏡頭是固定的，有記錄 `fixedLens` 的話順手帶入鏡頭欄位。
   * 相機與鏡頭一起用 updater 更新，理由同 `setField` 的說明。
   */
  function handleCameraChange(value: string) {
    const camera: CameraResponse | undefined = cameras.find((c) => c.id === Number(value))
    setValues((prev) => ({
      ...prev,
      cameraId: camera?.id,
      lensName: camera?.fixedLens ?? prev.lensName,
    }))
  }

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    // 少了這行，瀏覽器會用原生方式送出表單並整頁重新載入。
    e.preventDefault()
    onSubmit({ ...values, iso: Number(isoInput) })
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.row}>
        <Field name="brand" label="品牌" error={fieldErrors.brand}>
          <input
            id="brand"
            value={values.brand ?? ''}
            onChange={(e) => setField('brand', e.target.value || undefined)}
            maxLength={50}
            placeholder="Kodak"
            {...errorProps('brand')}
          />
        </Field>
        <Field name="filmName" label="底片名稱" required error={fieldErrors.filmName}>
          <input
            id="filmName"
            value={values.filmName}
            onChange={(e) => setField('filmName', e.target.value)}
            required
            maxLength={100}
            placeholder="Portra 400"
            {...errorProps('filmName')}
          />
        </Field>
      </div>

      <div className={styles.row}>
        <Field name="iso" label="ISO" required error={fieldErrors.iso}>
          <input
            id="iso"
            type="number"
            inputMode="numeric"
            value={isoInput}
            onChange={(e) => setIsoInput(e.target.value)}
            required
            min={1}
            max={12800}
            step={1}
            {...errorProps('iso')}
          />
        </Field>
        <Field name="format" label="規格" required error={fieldErrors.format}>
          <select
            id="format"
            value={values.format}
            onChange={(e) => setField('format', e.target.value as FilmFormat)}
            required
            {...errorProps('format')}
          >
            {FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className={styles.row}>
        <Field name="pushPullStops" label="增減感" error={fieldErrors.pushPullStops}>
          <select
            id="pushPullStops"
            value={values.pushPullStops ?? 0}
            onChange={(e) => setField('pushPullStops', Number(e.target.value))}
            {...errorProps('pushPullStops')}
          >
            {PUSH_PULL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field name="status" label="狀態" required error={fieldErrors.status}>
          <select
            id="status"
            value={values.status}
            onChange={(e) => setField('status', e.target.value as FilmRollStatus)}
            required
            {...errorProps('status')}
          >
            {availableStatuses.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className={styles.row}>
        <Field name="loadedAt" label="裝片日期" required error={fieldErrors.loadedAt}>
          <input
            id="loadedAt"
            type="date"
            value={toDateInputValue(values.loadedAt)}
            onChange={(e) => setField('loadedAt', e.target.value)}
            required
            {...errorProps('loadedAt')}
          />
        </Field>
        <Field
          name="finishedAt"
          label="拍完日期"
          hint="還在拍的話留空"
          error={fieldErrors.finishedAt}
        >
          <input
            id="finishedAt"
            type="date"
            value={toDateInputValue(values.finishedAt)}
            onChange={(e) => setField('finishedAt', e.target.value || undefined)}
            min={toDateInputValue(values.loadedAt) || undefined}
            {...errorProps('finishedAt')}
          />
        </Field>
      </div>

      <div className={styles.row}>
        <Field name="cameraId" label="相機" hint={cameraHint} error={fieldErrors.cameraId}>
          <select
            id="cameraId"
            value={values.cameraId ?? ''}
            onChange={(e) => handleCameraChange(e.target.value)}
            disabled={camerasQuery.isPending}
            {...errorProps('cameraId')}
          >
            <option value="">{camerasQuery.isPending ? '載入中…' : '不指定'}</option>
            {cameras.map((c) => {
              const accepts = cameraAcceptsFilm(c, values.format)
              return (
                // 目前選中的相機即使不相容也不能 disabled，否則下拉會顯示不出目前的值
                <option key={c.id} value={c.id} disabled={!accepts && c.id !== values.cameraId}>
                  {accepts ? c.name : `${c.name}（${CAMERA_FORMAT_LABELS[c.format]}片幅）`}
                </option>
              )
            })}
          </select>
        </Field>
        <Field
          name="lensName"
          label="鏡頭"
          hint="品牌、焦距與最大光圈；定焦機填機身內建的鏡頭"
          error={fieldErrors.lensName}
        >
          <input
            id="lensName"
            value={values.lensName ?? ''}
            onChange={(e) => setField('lensName', e.target.value || undefined)}
            maxLength={100}
            placeholder="Leica 50mm f/2"
            {...errorProps('lensName')}
          />
        </Field>
      </div>

      <Field name="notes" label="備註" error={fieldErrors.notes}>
        <textarea
          id="notes"
          className={styles.textarea}
          value={values.notes ?? ''}
          onChange={(e) => setField('notes', e.target.value || undefined)}
          maxLength={2000}
          rows={4}
          {...errorProps('notes')}
        />
      </Field>

      <div className={styles.actions}>
        {/* disabled 防止連點：沒有它，連點三下就會送出三次 */}
        <button type="submit" className={styles.submit} disabled={isSubmitting}>
          {isSubmitting ? '儲存中…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

/**
 * 新增頁表單一打開時的預設值。
 *
 * - `camera` 是要預先選好的相機（見 `lib/camera.ts` 的 `defaultCamera`），鏡頭跟著帶入它的 `fixedLens`。
 *   ISO 預設 400（PG-50 的 DX code 範圍是 100–400）。
 * - 「今天」用本地時區的年月日自己組，不用 `toISOString()`：它是 UTC，台灣凌晨 0～8 點會拿到昨天。
 * - `padStart` 不能省：`2026-9-5` 不是合法的 date input 值，欄位會一片空白。
 * - 寫成函式而不是常數，因為「今天」會變；常數在頁面開過午夜後就會是昨天。
 */
export function emptyFormValues(camera?: CameraResponse): FilmRollFormValues {
  const now = new Date()
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  return {
    filmName: '',
    iso: 400,
    format: '135',
    pushPullStops: 0,
    loadedAt: today,
    cameraId: camera?.id,
    lensName: camera?.fixedLens,
    status: 'LOADED',
  }
}
