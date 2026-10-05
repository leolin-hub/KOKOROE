import { useEffect, useId, useRef, useState } from 'react'
import type { FilmFormat } from '../types/filmRoll'
import type { CanisterPalette } from '../lib/canisterColors'
import type { FilmType } from '../lib/filmType'
import type { DxCode } from '../lib/dxCode'
import { hashString } from '../lib/canisterColors'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import styles from './FilmCanisterSvg.module.css'

/*
 * 寫實的 135 底片罐，稍微俯視（看得到橢圓頂蓋）。
 *
 * 【這支已經寫好】畫圖不是學習重點；你要寫的是餵給它的資料：配色、DX 格子、底片種類。
 *
 * 寫實感幾乎都來自光影，不是幾何：
 *   1. 標籤「包」在圓柱上：把攤平的標籤切成 28 條直條，每條依它在圓周上的角度水平壓縮，
 *      靠近兩側的字自然變窄。這一步讓字看起來是印在罐子上，而不是貼在平面上。
 *   2. 疊一層水平漸層：兩側暗、偏左一條高光。
 *   3. 金屬蓋：橢圓頂面、壓邊的溝紋、中間凸起的軸心。
 *   4. 片頭從右側的遮光絨縫口拉出來，齒孔沿著上下緣橫排（底片是橫著拉出來的）。
 *
 * 轉動：光影固定、只移動標籤，看起來像罐子在固定的光源下轉。
 * 每一幀直接改 28 個 <use> 的 transform，不經過 React state —— 一秒 60 次 re-render 太浪費。
 * JSX 裡的 transform 永遠是「角度 0」的固定字串，React 比對時值沒變就不會去動 DOM，所以不會蓋掉轉到一半的角度。
 *
 * 共用的漸層、裁切區與濾鏡在 `CanisterDefs`，整個 app 只 render 一次（App.tsx）。
 * 沒有 `CanisterDefs` 的頁面畫出來的罐子沒有光影、標籤也裁不出來 —— 在 App 以外的地方 render 罐子時要記得一起放。
 * 每個罐子只有自己的標籤內容需要獨立的 id（用 useId 產生）。
 */

// ── 幾何（單位都是 viewBox 的單位）────────────────────────────

// 罐身寬 100（半徑 R = 50），中心 x = 90。標籤攤平的長度 = 圓周 2πR，正面看得到半圈。
const CX = 90
const R = 50
const STRIP_COUNT = 28
const LABEL_LENGTH = 2 * Math.PI * R
const FRONT_CENTER = (Math.PI * R) / 2
const SPIN_SPEED = LABEL_LENGTH / 7 // 每秒轉 1/7 圈

/** 標籤底色的範圍：畫兩份標籤（轉到接縫時不露白），左右各多 10 */
const LABEL_BG = { x: -10, width: 2 * LABEL_LENGTH + 20 }
/** 罐身上光影與顆粒覆蓋的範圍（會再被罐身的裁切區裁掉） */
const BODY_OVERLAY = { x: 38, y: 56, width: 104, height: 180 }

/** 標籤背面的欄位位置：規格小字、條碼、DX 格子、直排品牌，由左到右不重疊 */
const BACK_TEXT_X = 176
const BARCODE_X = 238
const DX_X = 238
const DX_Y = 186
const DX_PITCH = 7.2
const DX_CELL = 6.6
const BACK_BRAND_X = 306

const LEADER_PATH = 'M142,74 L206,74 Q214,74 214,82 L214,130 Q214,138 206,138 L178,138 C169,138 171,206 160,206 L142,206 Z'
const LEADER_TOP_HOLES = [147, 165.3, 183.6, 201.9]

/** 正面第 i 條直條在螢幕上的 x 範圍（sx0～sx1），以及它對應到標籤上的哪一段（u0 起、長 du）。 */
const STRIPS = Array.from({ length: STRIP_COUNT }, (_, i) => {
  const t0 = -Math.PI / 2 + (i * Math.PI) / STRIP_COUNT
  const t1 = t0 + Math.PI / STRIP_COUNT
  return {
    sx0: CX + R * Math.sin(t0),
    sx1: CX + R * Math.sin(t1),
    u0: R * (t0 + Math.PI / 2),
    du: (R * Math.PI) / STRIP_COUNT,
  }
})

/** 把標籤上 [u0, u0 + du] 這一段，壓縮後搬到螢幕上 [sx0, sx1]。offset 是轉動的量。 */
function stripTransform(offset: number, i: number): string {
  const s = STRIPS[i]
  const u0 = s.u0 + (((offset % LABEL_LENGTH) + LABEL_LENGTH) % LABEL_LENGTH)
  const k = (s.sx1 - s.sx0) / s.du
  return `matrix(${k.toFixed(5)} 0 0 1 ${(s.sx0 - u0 * k).toFixed(3)} 0)`
}

const FILM_TYPE_PRINT: Record<FilmType, { line: string; process: string; base: string }> = {
  color: { line: 'COLOR NEGATIVE FILM', process: 'PROCESS C-41', base: '#b4652e' },
  bw: { line: 'BLACK & WHITE FILM', process: 'B&W PROCESS', base: '#3b3835' },
  slide: { line: 'COLOR REVERSAL FILM', process: 'PROCESS E-6', base: '#55585c' },
}

// ── 文字排進固定寬度 ────────────────────────────────────

/** 全形字（中日韓）約等於一個字級寬；半形字依字型而定，由呼叫端給 narrowEm */
const WIDE_CHAR = /[⺀-鿿가-힯＀-￯]/u

interface FitOptions {
  /** 可用寬度 */
  width: number
  /** 字級上限（短字不放大超過這個） */
  max: number
  /** 字級下限：再小就讀不到，改成截斷加「…」 */
  min: number
  /** 半形字寬是字級的幾倍（窄體粗字約 0.5） */
  narrowEm: number
  /** 字距是字級的幾倍 */
  trackingEm?: number
}

/**
 * 決定一行字的字級：放得下就用 max，放不下就縮小，縮到 min 還放不下就截斷。
 * SVG 的 <text> 不會自動換行，不處理的話長名字會繞到罐子側面去。
 * 寬度是估算的（不同字母寬度不同），只求「不會超出太多」。精準量測要等元素掛上畫面，會多一次 render。
 */
function fitText(text: string, options: FitOptions): { text: string; fontSize: number; letterSpacing: number } {
  const tracking = options.trackingEm ?? 0
  const emWidth = (chars: string[]) =>
    chars.reduce((sum, ch) => sum + (WIDE_CHAR.test(ch) ? 1 : options.narrowEm) + tracking, 0)

  const chars = [...text]
  const size = options.width / Math.max(emWidth(chars), 0.01)
  if (size >= options.min) {
    const fontSize = Math.min(options.max, size)
    return { text, fontSize, letterSpacing: fontSize * tracking }
  }

  // 縮到最小還放不下：從後面一個字一個字拿掉，直到加上「…」也放得下
  while (chars.length > 1 && (emWidth(chars) + options.narrowEm) * options.min > options.width) chars.pop()
  return { text: `${chars.join('').trimEnd()}…`, fontSize: options.min, letterSpacing: options.min * tracking }
}

/** ISO 換成 DIN 度數，罐子上印成 `ISO 400/27°`。 */
function dinDegrees(iso: number): number {
  return Math.round(10 * Math.log10(iso) + 1)
}

/** 條碼：20 條粗細不一的線，粗細由名稱的雜湊決定（裝飾用，不是真的條碼）。 */
function barcode(seed: number): { x: number; width: number }[] {
  let x = 0
  return Array.from({ length: 20 }, (_, i) => {
    const width = (seed >>> i) & 1 ? 1.7 : 0.8
    const bar = { x, width }
    x += width + 0.9
    return bar
  })
}

interface FilmCanisterSvgProps {
  /** 已經去掉前後空白；沒有品牌時是 undefined */
  brand?: string
  /** 已經拿掉品牌與 ISO 的片名，例如 `'Portra'`（見 `labelFilmName`） */
  name: string
  iso: number
  format: FilmFormat
  palette: CanisterPalette
  filmType: FilmType
  dx: DxCode
  /** 焦點卷期：加上顆粒，滑鼠移上去會轉動。非焦點的不加，捲動時少一點繪製成本。 */
  focused?: boolean
  /**
   * 底片條已經從出片口拉出來（底片盒的攤開動畫）：藏起罐子自己畫的片頭，不然會看到兩條片頭。
   * 拉出來的時候罐子也不轉，免得一邊拉底片一邊轉、視覺上打架。
   */
  unrolled?: boolean
}

export default function FilmCanisterSvg({
  brand,
  name,
  iso,
  format,
  palette,
  filmType,
  dx,
  focused = false,
  unrolled = false,
}: FilmCanisterSvgProps) {
  const reactId = useId()
  const labelId = `canister-label-${reactId}`
  const usesRef = useRef<(SVGUseElement | null)[]>([])
  const offsetRef = useRef(0)
  const [hovering, setHovering] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const spinning = focused && hovering && !reducedMotion && !unrolled

  useEffect(() => {
    if (!spinning) return
    let frame = 0
    let last = 0
    const step = (time: number) => {
      if (last) offsetRef.current += SPIN_SPEED * Math.min((time - last) / 1000, 0.1)
      last = time
      usesRef.current.forEach((use, i) => use?.setAttribute('transform', stripTransform(offsetRef.current, i)))
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [spinning])

  const print = FILM_TYPE_PRINT[filmType]
  const brandText = brand?.toUpperCase()
  const frontBrand = brandText && fitText(brandText, { width: 92, max: 10.5, min: 5.5, narrowEm: 0.62, trackingEm: 0.28 })
  const backBrand = brandText && fitText(brandText, { width: 128, max: 11, min: 6, narrowEm: 0.55, trackingEm: 0.11 })
  const frontName = fitText(name, { width: 96, max: 25, min: 8, narrowEm: 0.5 })
  const bars = barcode(hashString(`${brand ?? ''}${name}`))

  /** 標籤攤平後的一份（長度 = 圓周）。畫兩份接在一起，轉到接縫時才不會露出空白。 */
  function labelCopy(ox: number) {
    const c = ox + FRONT_CENTER
    return (
      <g key={ox}>
        {/* 正面：品牌、片名、ISO */}
        {frontBrand && (
          <text x={c} y={98} textAnchor="middle" fontSize={frontBrand.fontSize} fontWeight={700} style={{ letterSpacing: frontBrand.letterSpacing }} fill={palette.ink}>
            {frontBrand.text}
          </text>
        )}
        <text x={c} y={131} textAnchor="middle" fontSize={frontName.fontSize} fontWeight={800} style={{ fontStretch: '78%' }} fill={palette.ink}>
          {frontName.text}
        </text>
        <text className={styles.mono} x={c} y={170} textAnchor="middle" fontSize={6.4} style={{ letterSpacing: 2.2 }} fill={palette.accentInk}>
          ISO
        </text>
        <text x={c} y={203} textAnchor="middle" fontSize={37} fontWeight={800} style={{ fontStretch: '70%' }} fill={palette.accentInk}>
          {iso}
        </text>

        {/* 背面：規格小字、條碼、DX 格子、直排品牌 */}
        <text x={ox + BACK_TEXT_X} y={98} fontSize={17} fontWeight={800} style={{ fontStretch: '78%' }} fill={palette.ink}>
          {format}
        </text>
        <text className={styles.mono} x={ox + BACK_TEXT_X} y={110} fontSize={6.2} fill={palette.ink}>
          ISO {iso}/{dinDegrees(iso)}°
        </text>
        <text className={styles.mono} x={ox + BACK_TEXT_X} y={119} fontSize={4.6} style={{ letterSpacing: 0.4 }} fill={palette.ink}>
          {print.line}
        </text>
        <text className={styles.mono} x={ox + BACK_TEXT_X} y={127} fontSize={4.6} style={{ letterSpacing: 0.4 }} fill={palette.ink}>
          {print.process}
        </text>
        {bars.map((bar) => (
          <rect key={bar.x} x={ox + BARCODE_X + bar.x} y={92} width={bar.width} height={30} fill={palette.ink} />
        ))}
        <rect x={ox + DX_X - 1} y={DX_Y - 1} width={6 * DX_PITCH + 1.2} height={2 * DX_PITCH + 1.2} fill="#151312" />
        {[dx.row1, dx.row2].map((row, r) =>
          Array.from({ length: 6 }, (_, col) => (
            <rect
              key={`${r}-${col}`}
              x={ox + DX_X + col * DX_PITCH}
              y={DX_Y + r * DX_PITCH}
              width={DX_CELL}
              height={DX_CELL}
              fill={row[col] ? '#c9c4bb' : '#151312'}
            />
          )),
        )}
        {backBrand && (
          <text
            transform={`translate(${ox + BACK_BRAND_X} 198) rotate(-90)`}
            fontSize={backBrand.fontSize}
            fontWeight={800}
            style={{ fontStretch: '80%', letterSpacing: backBrand.letterSpacing }}
            fill={palette.ink}
          >
            {backBrand.text}
          </text>
        )}
      </g>
    )
  }

  return (
    <svg
      className={styles.canister}
      viewBox="20 32 206 226"
      role="img"
      aria-label={`${brand ? `${brand} ` : ''}${name} ISO ${iso} 底片罐`}
      // 一律掛上：只在焦點時才掛的話，滑鼠還在上面就失去焦點的那一卷收不到 leave，之後會自己轉起來
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
    >
      <defs>
        <g id={labelId} className={styles.label}>
          <rect x={LABEL_BG.x} y={40} width={LABEL_BG.width} height={200} fill={palette.base} />
          <rect x={LABEL_BG.x} y={150} width={LABEL_BG.width} height={90} fill={palette.accent} />
          <rect x={LABEL_BG.x} y={145.5} width={LABEL_BG.width} height={1.2} fill={palette.ink} opacity={0.45} />
          {labelCopy(0)}
          {labelCopy(LABEL_LENGTH)}
        </g>
      </defs>

      {/* 落影 */}
      <ellipse className={styles.ground} cx={100} cy={236} rx={66} ry={10} filter="url(#canister-blur)" />

      {/* 片頭：片基顏色依底片種類，齒孔是鏤空的（填背景色） */}
      <g className={styles.leader} data-hidden={unrolled || undefined}>
        <path d={LEADER_PATH} fill={print.base} />
        <path d={LEADER_PATH} fill="url(#canister-leader-sheen)" />
        {LEADER_TOP_HOLES.map((x) => (
          <rect key={x} className={styles.hole} x={x} y={81} width={7.6} height={10} rx={1.2} />
        ))}
        <rect className={styles.hole} x={147} y={189} width={7.6} height={10} rx={1.2} />
      </g>

      {/* 罐身：標籤直條 + 光影 + 顆粒 */}
      <g clipPath="url(#canister-body)">
        {STRIPS.map((_, i) => (
          <g key={i} clipPath={`url(#canister-strip-${i})`}>
            <use
              ref={(el) => {
                usesRef.current[i] = el
              }}
              href={`#${labelId}`}
              transform={stripTransform(0, i)}
            />
          </g>
        ))}
        <rect {...BODY_OVERLAY} fill="url(#canister-shade)" />
        <path d="M40,70 A50,12 0 0 0 140,70 L140,90 A50,12 0 0 1 40,90 Z" fill="url(#canister-cap-shadow)" />
        {focused && <rect {...BODY_OVERLAY} filter="url(#canister-grain)" opacity={0.32} />}
      </g>

      {/* 遮光絨：片頭出口 */}
      <rect x={136} y={72} width={9} height={140} rx={1.5} fill="url(#canister-felt)" />

      {/* 底蓋 */}
      <path d="M37,210 A53,12.8 0 0 0 143,210 L143,222 A53,12.8 0 0 1 37,222 Z" fill="url(#canister-metal-band)" />
      <path className={styles.groove} d="M37,216 A53,12.8 0 0 0 143,216" />
      <path className={styles.lip} d="M37,210 A53,12.8 0 0 0 143,210" />

      {/* 頂蓋：側面一圈、橢圓頂面、壓邊、軸心 */}
      <path d="M37,56 L37,70 A53,12.8 0 0 0 143,70 L143,56 Z" fill="url(#canister-metal-band)" />
      <path className={styles.groove} d="M37,63 A53,12.8 0 0 0 143,63" />
      <ellipse cx={90} cy={56} rx={53} ry={12.8} fill="url(#canister-metal-face)" />
      <ellipse className={styles.rim} cx={90} cy={56} rx={52.3} ry={12.4} />
      <ellipse className={styles.rimInner} cx={90} cy={56.6} rx={45.5} ry={10.8} />
      <ellipse cx={91.5} cy={57} rx={13.5} ry={3.5} fill="#000" opacity={0.35} />
      <path d="M79,44 A11,2.7 0 0 0 101,44 L101,56 A11,2.7 0 0 1 79,56 Z" fill="url(#canister-spool)" />
      <ellipse cx={90} cy={44} rx={11} ry={2.7} fill="url(#canister-spool-top)" />
      <ellipse cx={90} cy={44.2} rx={5.4} ry={1.35} fill="#0b0a09" />
    </svg>
  )
}

/**
 * 所有底片罐共用的漸層、裁切區與濾鏡。App.tsx 在最外層 render 一次。
 *
 * 放在一個寬高 0 的 SVG 裡，而不是 `display: none`：有些瀏覽器不會套用藏在 display: none 裡的漸層與裁切。
 * id 全部以 `canister-` 開頭，避免和別的 SVG 撞名。
 */
export function CanisterDefs() {
  return (
    <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="canister-body">
          <path d="M40,64 L40,218 A50,12 0 0 0 140,218 L140,64 Z" />
        </clipPath>
        {STRIPS.map((s, i) => (
          <clipPath key={i} id={`canister-strip-${i}`}>
            {/* 左右各多 0.3，相鄰直條重疊一點，避免接縫露出細線 */}
            <rect x={s.sx0 - 0.3} y={30} width={s.sx1 - s.sx0 + 0.6} height={220} />
          </clipPath>
        ))}

        {/* 圓柱的明暗：兩側暗、偏左一條亮帶，中間偏右慢慢暗下去 */}
        <linearGradient id="canister-shade" gradientUnits="userSpaceOnUse" x1={40} y1={0} x2={140} y2={0}>
          <stop offset="0" stopColor="#000" stopOpacity={0.66} />
          <stop offset="0.08" stopColor="#000" stopOpacity={0.36} />
          <stop offset="0.2" stopColor="#000" stopOpacity={0.08} />
          <stop offset="0.29" stopColor="#fff" stopOpacity={0.2} />
          <stop offset="0.33" stopColor="#fff" stopOpacity={0.38} />
          <stop offset="0.38" stopColor="#fff" stopOpacity={0.1} />
          <stop offset="0.58" stopColor="#000" stopOpacity={0} />
          <stop offset="0.8" stopColor="#000" stopOpacity={0.2} />
          <stop offset="0.93" stopColor="#000" stopOpacity={0.45} />
          <stop offset="1" stopColor="#000" stopOpacity={0.64} />
        </linearGradient>
        {/* 頂蓋在標籤上投下的影子 */}
        <linearGradient id="canister-cap-shadow" x1={0} y1={0} x2={0} y2={1}>
          <stop offset="0" stopColor="#000" stopOpacity={0.55} />
          <stop offset="0.5" stopColor="#000" stopOpacity={0.16} />
          <stop offset="1" stopColor="#000" stopOpacity={0} />
        </linearGradient>

        {/* 銀色金屬蓋：側面、頂面、軸心 */}
        <linearGradient id="canister-metal-band" gradientUnits="userSpaceOnUse" x1={37} y1={0} x2={143} y2={0}>
          <stop offset="0" stopColor="#4f4b47" />
          <stop offset="0.1" stopColor="#8b857d" />
          <stop offset="0.27" stopColor="#f2efe9" />
          <stop offset="0.33" stopColor="#d8d3cb" />
          <stop offset="0.55" stopColor="#a39d94" />
          <stop offset="0.8" stopColor="#6e6862" />
          <stop offset="1" stopColor="#3c3834" />
        </linearGradient>
        <linearGradient id="canister-metal-face" gradientUnits="userSpaceOnUse" x1={50} y1={44} x2={130} y2={70}>
          <stop offset="0" stopColor="#f3f0ea" />
          <stop offset="0.55" stopColor="#c2bcb3" />
          <stop offset="1" stopColor="#8f8981" />
        </linearGradient>
        <linearGradient id="canister-spool" gradientUnits="userSpaceOnUse" x1={79} y1={0} x2={101} y2={0}>
          <stop offset="0" stopColor="#6d6760" />
          <stop offset="0.3" stopColor="#ebe7e1" />
          <stop offset="0.6" stopColor="#9b958d" />
          <stop offset="1" stopColor="#57524c" />
        </linearGradient>
        <linearGradient id="canister-spool-top" x1={0} y1={0} x2={1} y2={1}>
          <stop offset="0" stopColor="#e2ddd6" />
          <stop offset="1" stopColor="#a39d95" />
        </linearGradient>

        {/* 片頭的光澤與遮光絨 */}
        <linearGradient id="canister-leader-sheen" gradientUnits="userSpaceOnUse" x1={0} y1={74} x2={0} y2={206}>
          <stop offset="0" stopColor="#fff" stopOpacity={0} />
          <stop offset="0.16" stopColor="#fff" stopOpacity={0.3} />
          <stop offset="0.3" stopColor="#fff" stopOpacity={0} />
          <stop offset="0.75" stopColor="#000" stopOpacity={0.12} />
          <stop offset="1" stopColor="#000" stopOpacity={0.32} />
        </linearGradient>
        <linearGradient id="canister-felt" gradientUnits="userSpaceOnUse" x1={136} y1={0} x2={145} y2={0}>
          <stop offset="0" stopColor="#0b0908" />
          <stop offset="0.45" stopColor="#2b2421" />
          <stop offset="0.75" stopColor="#16110f" />
          <stop offset="1" stopColor="#060505" />
        </linearGradient>

        <filter id="canister-blur" x="-30%" y="-120%" width="160%" height="340%">
          <feGaussianBlur stdDeviation={5} />
        </filter>
        {/* 顆粒：雜訊只留暗點，透明度由 R 通道決定 */}
        <filter id="canister-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency={0.9} numOctaves={2} seed={7} stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.3 0 0 0 -0.5" />
        </filter>
      </defs>
    </svg>
  )
}
