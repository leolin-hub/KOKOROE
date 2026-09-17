import styles from './RollArtwork.module.css'

interface FilmCanisterSvgProps {
  /** 罐身主色，例如 `'hsl(32 62% 46%)'`。由 `lib/canisterColors.ts` 依底片名稱算出。 */
  bodyColor: string
  /** 標籤帶的顏色，和罐身形成對比。 */
  labelColor: string
  /** 標籤上的大字，通常是品牌（沒有品牌時用底片名稱）。 */
  title: string
  /** 標籤上的小字，例如 `'ISO 400'`。 */
  subtitle: string
}

/**
 * 沒有底片捲照片時的替代外觀：一個風格化的 135 底片罐。
 *
 * 【這支已經寫好】畫圖不是這一步的學習重點；你要寫的是 RollArtwork 裡「用照片還是用這支」的判斷。
 *
 * - 不畫任何品牌 logo，只用顏色和文字，避開商標圖像的問題。
 * - `viewBox` 固定、寬高交給 CSS：SVG 會跟著外框縮放，不需要傳尺寸進來。
 * - `role="img"` 加 `aria-label`：對螢幕閱讀器來說整張是一張圖，不要逐一念出裡面的 `<text>`。
 * - 金屬蓋、片舌的顏色寫在 CSS（`.canisterMetal`、`.canisterLeader`），不跟著底片變色。
 */
export default function FilmCanisterSvg({ bodyColor, labelColor, title, subtitle }: FilmCanisterSvgProps) {
  return (
    <svg
      className={styles.canister}
      viewBox="0 0 120 160"
      role="img"
      aria-label={`${title} ${subtitle} 底片罐`}
    >
      {/* 片舌：從罐身右側拉出來的一小段底片 */}
      <path className={styles.canisterLeader} d="M96 58 h18 a4 4 0 0 1 4 4 v36 a4 4 0 0 1 -4 4 h-18 z" />
      {[66, 78, 90].map((y) => (
        <rect key={y} className={styles.canisterSprocket} x="104" y={y} width="6" height="5" rx="1" />
      ))}

      {/* 上下金屬蓋與中間的軸心 */}
      <rect className={styles.canisterMetal} x="22" y="6" width="76" height="14" rx="4" />
      <rect className={styles.canisterMetal} x="50" y="0" width="20" height="8" rx="2" />
      <rect className={styles.canisterMetal} x="22" y="140" width="76" height="14" rx="4" />

      {/* 罐身與標籤帶 */}
      <rect x="18" y="18" width="84" height="124" rx="6" fill={bodyColor} />
      <rect x="18" y="52" width="84" height="56" fill={labelColor} />

      <text className={styles.canisterTitle} x="60" y="78" textAnchor="middle">
        {title}
      </text>
      <text className={styles.canisterSubtitle} x="60" y="96" textAnchor="middle">
        {subtitle}
      </text>
    </svg>
  )
}
