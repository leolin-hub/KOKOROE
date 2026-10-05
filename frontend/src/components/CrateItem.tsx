import type { FilmRollResponse } from '../types/filmRoll'
import styles from './CrateItem.module.css'
import { Link } from 'react-router'
import type { CSSProperties } from 'react'
import RollArtwork from './RollArtwork'
import StatusBadge from './StatusBadge'
import { formatRollTitle, formatDate } from '../lib/format'
import { FORMAT_OPTIONS } from '../lib/constants'
import { UNROLL_MS } from '../lib/unroll'
import UnrolledFilm from './UnrolledFilm'
import type { PhotoResponse } from '../types/photo'

interface CrateItemProps {
  roll: FilmRollResponse
  /**
   * 這一卷相對於焦點卷期的位置：`index - focusedIndex`。
   * 0 是焦點本身，-1 是焦點的上一卷，2 是下兩卷，依此類推。
   */
  offset: number
  /** 點進詳情頁時帶過去的 `state`，讓詳情頁的返回連結回到唱片櫃（見 `lib/backLink.ts`）。 */
  linkState: unknown
  /** 這一卷的底片條是不是拉出來了（只有焦點卷期會是 true） */
  unrolled: boolean
  /** 點了非焦點卷期的罐子：捲過去讓它變成焦點 */
  onSelect: () => void
  /** 點了焦點卷期的罐子：拉出或收回底片條 */
  onToggleUnroll: () => void
  /** 點了底片條上的某一格 */
  onOpenPhoto: (photo: PhotoResponse) => void
  /** 在底片條上按 Esc */
  onCloseUnroll: () => void
}

/**
 * 唱片櫃裡的一格。
 *
 * 【影響畫面】唱片櫃瀏覽頁（/crate）裡的每一卷。焦點卷期放大、顯示完整資訊；
 *   其他卷期往後傾、縮小、變淡，只露出外觀與標題。
 *   傾斜與縮放全部寫在 `CrateItem.module.css`（已完成），這個元件只負責把 `offset` 翻譯成 CSS 看得懂的兩個值。
 *
 * 【會用到】
 *   - `Link`                                         'react-router'            ← 要自己 import
 *   - `CSSProperties`（type）                         'react'                   ← 要自己 import type
 *   - `RollArtwork`                                   './RollArtwork'           ← 要自己 import
 *   - `StatusBadge`                                   './StatusBadge'           ← 要自己 import
 *   - `formatRollTitle`、`formatDate`                 '../lib/format'           ← 要自己 import
 *   - `FORMAT_OPTIONS`（找規格的顯示文字，可選）        '../lib/constants'        ← 要自己 import
 *   - styles：`slot`、`record`、`artworkLink`、`info`、`title`、`meta`、`details`、`detailLink`
 *
 * 【步驟】
 * 1. 把參數改成解構 `{ roll, offset }`，刪掉 `void props` 與佔位的 `<li>`。
 * 2. 算出 CSS 需要的兩個值：
 *    - `const position = offset === 0 ? 'focused' : offset < 0 ? 'before' : 'after'`
 *    - `const distance = Math.min(Math.abs(offset), 3)`（超過 3 格一律算 3，太遠的不用再更斜）
 * 3. 外層是 `<li>`（頁面用 `<ol>` 包起來）：
 *    ```tsx
 *    <li
 *      className={styles.slot}
 *      data-position={position}
 *      style={{ '--distance': distance } as CSSProperties}
 *      aria-current={offset === 0 ? 'true' : undefined}
 *    >
 *    ```
 * 4. 裡面一個 `<div className={styles.record}>`，分左右兩塊：
 *    - 左：`<Link to={`/film-rolls/${roll.id}`} className={styles.artworkLink} ...>` 包住 `<RollArtwork roll={roll} />`
 *      （3c 起改成按鈕：焦點卷期按了從出片口拉出底片條（UnrolledFilm），其他卷期按了捲過去變焦點）
 *    - 右：`<div className={styles.info}>` 裡放
 *        `<h2 className={styles.title}>` 標題（formatRollTitle）
 *        `<p className={styles.meta}>` 一行規格：`ISO 400 · 135 · PENTAX PG-50`（沒有相機就不顯示那一段）
 *        `<div className={styles.details}>` 收起來的詳細資訊：StatusBadge、裝片日期（formatDate）、「查看詳情 →」連結
 *
 * 【坑】
 * - `style={{ '--distance': distance }}` 直接寫會型別錯誤：React 的 `CSSProperties` 不認得自訂屬性。
 *   要 `as CSSProperties` 轉型。這是 React + TypeScript 設 CSS 變數的標準寫法。
 * - 非焦點卷期的連結要加 `tabIndex={offset === 0 ? undefined : -1}`：
 *   不加的話，按 Tab 會一路經過櫃子裡每一卷的每個連結（20 卷就是 40 次 Tab），
 *   而且焦點會跳到看不見（被 CSS 收起來）的連結上。只讓焦點卷期的連結能被 Tab 到。
 * - 左邊圖片連結裡沒有文字，要加 `aria-label={`${title} 詳情`}`，不然螢幕閱讀器只會念「連結」。
 * - 一行規格用陣列組：`[`ISO ${roll.iso}`, formatLabel, roll.camera?.name].filter(Boolean).join(' · ')`，
 *   不要用一串 `&&` 拼字串，沒有相機時會多出一個 ` · ` 或 `undefined`。
 */
export default function CrateItem({
  roll,
  offset,
  linkState,
  unrolled,
  onSelect,
  onToggleUnroll,
  onOpenPhoto,
  onCloseUnroll,
}: CrateItemProps) {
  const focused = offset === 0
  const position = focused ? 'focused' : offset < 0 ? 'before' : 'after'
  const distance = Math.min(Math.abs(offset), 3)
  const formatLabel = FORMAT_OPTIONS.find((f) => f.value === roll.format)?.label
  const title = formatRollTitle(roll.filmName, roll.brand)

  return (
    <li
      className={styles.slot}
      data-position={position}
      style={{ '--distance': distance, '--unroll-duration': `${UNROLL_MS}ms` } as CSSProperties}
      aria-current={focused ? 'true' : undefined}
    >
      <div className={styles.record} data-unrolled={(focused && unrolled) || undefined}>
        {/*
          罐子是按鈕：焦點卷期按了拉出／收回底片條；其他卷期按了就捲過去變成焦點。
          非焦點的不進 Tab 順序（同下面的連結），鍵盤用 ↑ ↓ 切換。
        */}
        <button
          type="button"
          className={styles.artworkButton}
          onClick={focused ? onToggleUnroll : onSelect}
          tabIndex={focused ? undefined : -1}
          aria-expanded={focused ? unrolled : undefined}
          aria-label={focused ? `${unrolled ? '收回' : '拉出'} ${title} 的底片` : title}
        >
          <RollArtwork roll={roll} focused={focused} unrolled={focused && unrolled} />
        </button>
        {/* 只有焦點卷期才掛：一次只會有一卷拉出來，其他卷不必各自去抓照片 */}
        {focused && (
          <UnrolledFilm
            roll={roll}
            open={unrolled}
            linkState={linkState}
            onOpenPhoto={onOpenPhoto}
            onClose={onCloseUnroll}
          />
        )}
        <div className={styles.info}>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.meta}>
            {[`ISO ${roll.iso}`, formatLabel, roll.camera?.name].filter(Boolean).join(' · ')}
          </p>
          <div className={styles.details}>
            <StatusBadge status={roll.status} />
            <span>{formatDate(roll.loadedAt)}</span>
            <Link
              to={`/film-rolls/${roll.id}`}
              state={linkState}
              className={styles.detailLink}
              tabIndex={focused && !unrolled ? undefined : -1}
            >
              查看詳情 →
            </Link>
          </div>
        </div>
      </div>
    </li>
  )
}
