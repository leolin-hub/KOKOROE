import { Link } from 'react-router'
import StatusBadge from './StatusBadge'
import { FORMAT_OPTIONS } from '../lib/constants'
import { formatDate, formatPushPull, formatRollTitle } from '../lib/format'
import type { FilmRollResponse } from '../types/filmRoll'
import styles from './FilmRollCard.module.css'

interface FilmRollCardProps {
  roll: FilmRollResponse
}

/**
 * 列表上的單張卷期卡片。
 *
 * - 整張卡片是一個 Link，手機上好按。代價是卡片裡**不能**再放 `<a>` 或 `<button>`
 *   （互動元素不可嵌套）；日後要加「快速刪除」就得改成只有標題是 Link。
 * - optional 欄位（相機）不存在時整列不顯示：卡片重資訊密度，一排 `—` 很吵。
 *   詳情頁則相反，要顯示佔位符。
 * - 名稱→值的資料用 `<dl>`，螢幕閱讀器會讀成有結構的清單。
 *   `<div>` 包住每組 `<dt>/<dd>` 是 HTML 規範允許的寫法，方便排版。
 */
export default function FilmRollCard({ roll }: FilmRollCardProps) {
  const formatLabel =
    FORMAT_OPTIONS.find((o) => o.value === roll.format)?.label ?? roll.format

  return (
    <Link to={`/film-rolls/${roll.id}`} className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>{formatRollTitle(roll.filmName, roll.brand)}</h2>
        <StatusBadge status={roll.status} />
      </div>
      <dl className={styles.meta}>
        <div>
          <dt className={styles.metaLabel}>ISO</dt>
          <dd className={styles.metaValue}>{roll.iso}</dd>
        </div>
        <div>
          <dt className={styles.metaLabel}>規格</dt>
          <dd className={styles.metaValue}>{formatLabel}</dd>
        </div>
        <div>
          <dt className={styles.metaLabel}>增減感</dt>
          <dd className={styles.metaValue}>{formatPushPull(roll.pushPullStops)}</dd>
        </div>
        <div>
          <dt className={styles.metaLabel}>裝片日期</dt>
          <dd className={styles.metaValue}>{formatDate(roll.loadedAt)}</dd>
        </div>
        {roll.camera && (
          <div>
            <dt className={styles.metaLabel}>相機</dt>
            <dd className={styles.metaValue}>{roll.camera.name}</dd>
          </div>
        )}
      </dl>
    </Link>
  )
}
