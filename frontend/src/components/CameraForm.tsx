import { useState } from 'react'
import type { SubmitEvent } from 'react'
import Field from './FormField'
import {
  CAMERA_FORMAT_OPTIONS,
  CAMERA_TYPE_LABELS,
  FILM_ADVANCE_LABELS,
  FOCUS_TYPE_LABELS,
} from '../lib/constants'
import type { CameraFormat, UpdateCameraRequest } from '../types/camera'
import styles from './Form.module.css'

/** 表單的值型別。新增與編輯的請求欄位相同，理由同 `FilmRollFormValues`。 */
export type CameraFormValues = UpdateCameraRequest

interface CameraFormProps {
  /** 表單的初始值。和卷期表單一樣只在第一次 mount 時採用，編輯頁要等資料到齊再 render。 */
  initialValues: CameraFormValues
  onSubmit: (values: CameraFormValues) => void
  isSubmitting: boolean
  /** 後端 400 回來的欄位錯誤，由 `toFieldErrors()` 產生。 */
  fieldErrors: Record<string, string>
  submitLabel: string
}

/**
 * 「不知道 / 有 / 沒有」三態下拉用的轉換。
 *
 * `<select>` 的 value 只能是字串，而 `hasFlash` 是 `boolean | undefined`。
 * 不用 checkbox：checkbox 只有勾與不勾，表達不了「還不知道」，
 * 沒勾會被當成 `false` 送出，資料就從「不知道」變成「沒有閃光燈」。
 */
function toTriState(value: boolean | undefined): string {
  return value === undefined ? '' : String(value)
}

function fromTriState(value: string): boolean | undefined {
  return value === '' ? undefined : value === 'true'
}

/** 選填的 enum 下拉：選「不知道」（value 為 ''）時存 undefined。 */
function optionalEnum<T extends string>(value: string): T | undefined {
  return value === '' ? undefined : (value as T)
}

/** ISO 輸入框的字串轉數字：空白代表沒填。範圍交給瀏覽器的 min / max 與後端檢查。 */
function toOptionalNumber(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value)
}

/**
 * 新增頁與編輯頁共用的相機表單。
 *
 * 【影響畫面】
 *   - /cameras/new：預設值來自 `emptyCameraValues()`，按「建立相機」
 *   - /cameras/:id/edit：帶入這台相機目前的規格，按「儲存變更」
 *
 * 【幾個刻意的設計】（與 FilmRollForm 相同的部分不再重複：選填清空存 undefined、`?? ''`、數字用字串 state）
 * - 只有型號與片幅必填。規格一律有「不知道」選項，對應後端的 null。
 * - 「可換鏡頭」選「是」時停用定焦鏡頭欄位並清空它：後端規定可換鏡頭的機身不能有定焦鏡頭。
 *   只停用不清空的話，舊值還留在 state 裡，送出會被 400 擋下，使用者卻看不到是哪個欄位。
 * - ISO 下限的輸入框 `max` 綁上限、上限的 `min` 綁下限，讓瀏覽器先擋「下限大於上限」。
 */
export default function CameraForm({
  initialValues,
  onSubmit,
  isSubmitting,
  fieldErrors,
  submitLabel,
}: CameraFormProps) {
  const [values, setValues] = useState<CameraFormValues>(initialValues)
  const [isoMinInput, setIsoMinInput] = useState(initialValues.isoMin?.toString() ?? '')
  const [isoMaxInput, setIsoMaxInput] = useState(initialValues.isoMax?.toString() ?? '')

  function setField<K extends keyof CameraFormValues>(key: K, value: CameraFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function errorProps(name: keyof CameraFormValues) {
    const message = fieldErrors[name]
    return {
      'aria-invalid': Boolean(message),
      'aria-describedby': message ? `${name}-error` : undefined,
    }
  }

  function handleInterchangeableLensChange(value: string) {
    const interchangeableLens = fromTriState(value)
    setValues((prev) => ({
      ...prev,
      interchangeableLens,
      fixedLens: interchangeableLens ? undefined : prev.fixedLens,
    }))
  }

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    onSubmit({
      ...values,
      isoMin: toOptionalNumber(isoMinInput),
      isoMax: toOptionalNumber(isoMaxInput),
    })
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
            placeholder="PENTAX"
            {...errorProps('brand')}
          />
        </Field>
        <Field name="model" label="型號" required error={fieldErrors.model}>
          <input
            id="model"
            value={values.model}
            onChange={(e) => setField('model', e.target.value)}
            required
            maxLength={100}
            placeholder="PG-50"
            {...errorProps('model')}
          />
        </Field>
      </div>

      <div className={styles.row}>
        <Field name="format" label="片幅" required error={fieldErrors.format}>
          <select
            id="format"
            value={values.format}
            onChange={(e) => setField('format', e.target.value as CameraFormat)}
            required
            {...errorProps('format')}
          >
            {CAMERA_FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field name="cameraType" label="機型" error={fieldErrors.cameraType}>
          <select
            id="cameraType"
            value={values.cameraType ?? ''}
            onChange={(e) => setField('cameraType', optionalEnum(e.target.value))}
            {...errorProps('cameraType')}
          >
            <option value="">不知道</option>
            {Object.entries(CAMERA_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className={styles.row}>
        <Field name="focusType" label="對焦方式" error={fieldErrors.focusType}>
          <select
            id="focusType"
            value={values.focusType ?? ''}
            onChange={(e) => setField('focusType', optionalEnum(e.target.value))}
            {...errorProps('focusType')}
          >
            <option value="">不知道</option>
            {Object.entries(FOCUS_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field name="filmAdvance" label="過片方式" error={fieldErrors.filmAdvance}>
          <select
            id="filmAdvance"
            value={values.filmAdvance ?? ''}
            onChange={(e) => setField('filmAdvance', optionalEnum(e.target.value))}
            {...errorProps('filmAdvance')}
          >
            <option value="">不知道</option>
            {Object.entries(FILM_ADVANCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className={styles.row}>
        <Field name="hasFlash" label="內建閃光燈" error={fieldErrors.hasFlash}>
          <select
            id="hasFlash"
            value={toTriState(values.hasFlash)}
            onChange={(e) => setField('hasFlash', fromTriState(e.target.value))}
            {...errorProps('hasFlash')}
          >
            <option value="">不知道</option>
            <option value="true">有</option>
            <option value="false">沒有</option>
          </select>
        </Field>
        <Field name="interchangeableLens" label="可換鏡頭" error={fieldErrors.interchangeableLens}>
          <select
            id="interchangeableLens"
            value={toTriState(values.interchangeableLens)}
            onChange={(e) => handleInterchangeableLensChange(e.target.value)}
            {...errorProps('interchangeableLens')}
          >
            <option value="">不知道</option>
            <option value="true">可以</option>
            <option value="false">不行（定焦機）</option>
          </select>
        </Field>
      </div>

      <div className={styles.row}>
        <Field
          name="fixedLens"
          label="定焦鏡頭"
          hint={
            values.interchangeableLens
              ? '可換鏡頭的相機不填，鏡頭記在每一卷上'
              : '新增卷期選這台相機時會自動帶入鏡頭欄位'
          }
          error={fieldErrors.fixedLens}
        >
          <input
            id="fixedLens"
            value={values.fixedLens ?? ''}
            onChange={(e) => setField('fixedLens', e.target.value || undefined)}
            disabled={values.interchangeableLens === true}
            maxLength={100}
            placeholder="35mm f/4.5"
            {...errorProps('fixedLens')}
          />
        </Field>
        <Field name="shutterSpeedRange" label="快門速度" error={fieldErrors.shutterSpeedRange}>
          <input
            id="shutterSpeedRange"
            value={values.shutterSpeedRange ?? ''}
            onChange={(e) => setField('shutterSpeedRange', e.target.value || undefined)}
            maxLength={50}
            placeholder="1/60–1/250"
            {...errorProps('shutterSpeedRange')}
          />
        </Field>
      </div>

      <div className={styles.row}>
        <Field name="isoMin" label="ISO 下限" hint="DX 可讀取或可手動設定的範圍" error={fieldErrors.isoMin}>
          <input
            id="isoMin"
            type="number"
            inputMode="numeric"
            value={isoMinInput}
            onChange={(e) => setIsoMinInput(e.target.value)}
            min={1}
            max={isoMaxInput || 12800}
            step={1}
            placeholder="100"
            {...errorProps('isoMin')}
          />
        </Field>
        <Field name="isoMax" label="ISO 上限" error={fieldErrors.isoMax}>
          <input
            id="isoMax"
            type="number"
            inputMode="numeric"
            value={isoMaxInput}
            onChange={(e) => setIsoMaxInput(e.target.value)}
            min={isoMinInput || 1}
            max={12800}
            step={1}
            placeholder="400"
            {...errorProps('isoMax')}
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
          rows={3}
          {...errorProps('notes')}
        />
      </Field>

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={isSubmitting}>
          {isSubmitting ? '儲存中…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
