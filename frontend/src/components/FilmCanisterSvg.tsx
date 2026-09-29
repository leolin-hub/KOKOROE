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

/** 標籤帶內可放文字的寬度（viewBox 單位）：標籤寬 84，左右各留 4。 */
const LABEL_TEXT_WIDTH = 76

/**
 * 估算一行文字在 SVG 裡的寬度，超過 `maxWidth` 時回傳要壓縮到的長度，否則回傳 undefined。
 *
 * 不能無條件設 `textLength`：它會把文字「剛好」撐到那個長度，短字（例如 `Kodak`）會被拉得很開。
 * 所以只在估計會超出時才設，搭配 `lengthAdjust="spacingAndGlyphs"` 把字形與間距一起壓窄。
 *
 * 估算方式：全形字（中日韓）約等於字級，半形字約 0.62 倍字級（粗體無襯線字體的平均值）。
 * 不需要精準 —— 估大了只是提早壓縮一點點，估小了最多超出一兩個單位。
 * 精準量測要用 `getComputedTextLength()`，但那得等元素掛上畫面才能量，會多一次 render。
 */
function fitTextLength(text: string, fontSize: number, maxWidth: number): number | undefined {
  let width = 0
  for (const char of text) {
    width += /[　-鿿가-힯＀-￯]/.test(char) ? fontSize : fontSize * 0.62
  }
  return width > maxWidth ? maxWidth : undefined
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
 * - 標籤文字太長時壓縮成標籤寬度（見 `fitTextLength`）；SVG 的 `<text>` 不會自動換行，不壓縮就會跑出罐子外。
 *   字級 13 / 10 要和 RollArtwork.module.css 的 `.canisterTitle` / `.canisterSubtitle` 一致。
 */
export default function FilmCanisterSvg({ bodyColor, labelColor, title, subtitle }: FilmCanisterSvgProps) {
  const titleLength = fitTextLength(title, 13, LABEL_TEXT_WIDTH)
  const subtitleLength = fitTextLength(subtitle, 10, LABEL_TEXT_WIDTH)

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

      <text
        className={styles.canisterTitle}
        x="60"
        y="78"
        textAnchor="middle"
        textLength={titleLength}
        lengthAdjust={titleLength ? 'spacingAndGlyphs' : undefined}
      >
        {title}
      </text>
      <text
        className={styles.canisterSubtitle}
        x="60"
        y="96"
        textAnchor="middle"
        textLength={subtitleLength}
        lengthAdjust={subtitleLength ? 'spacingAndGlyphs' : undefined}
      >
        {subtitle}
      </text>
    </svg>
  )
}
