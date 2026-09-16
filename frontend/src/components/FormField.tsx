import type { ReactNode } from 'react'
import FieldError from './FieldError'
import styles from './Form.module.css'

interface FormFieldProps {
  /** 欄位名，同時當作輸入元件的 `id` 與 FieldError 的 `fieldId`。 */
  name: string
  label: string
  required?: boolean
  /** 欄位下方的灰色提示文字。 */
  hint?: string
  error?: string
  /** 輸入元件本身。記得帶上 `id={name}`，label 的 htmlFor 才對得起來。 */
  children: ReactNode
}

/**
 * 表單裡一個欄位的外框：label、輸入元件、提示文字、錯誤訊息。
 *
 * 卷期表單與相機表單共用，樣式在 `Form.module.css`。
 * 原本寫在 FilmRollForm 裡、`name` 限定為卷期的欄位名；有第二個表單後抽出來，`name` 放寬成 string。
 * 欄位名打錯的保護仍在各表單的 `errorProps()`／`setField()`，那裡的型別是各自表單的欄位。
 */
export default function FormField({ name, label, required, hint, error, children }: FormFieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={name} className={styles.label}>
        {label}
        {/* 必填已經由輸入元件的 required 屬性表達，星號只給眼睛看，不讓螢幕閱讀器念出來 */}
        {required && (
          <span className={styles.required} aria-hidden="true">
            {' '}*
          </span>
        )}
      </label>
      {children}
      {hint && <p className={styles.hint}>{hint}</p>}
      <FieldError fieldId={name} message={error} />
    </div>
  )
}
