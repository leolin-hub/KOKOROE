import { useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent, WheelEvent } from 'react'
import { Link } from 'react-router'
import { photoUrl } from '../api/photos'
import { usePhotos } from '../hooks/usePhotos'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { formatRollTitle } from '../lib/format'
import { UNROLL_MS, VISIBLE_FRAMES } from '../lib/unroll'
import type { FilmRollResponse } from '../types/filmRoll'
import type { PhotoResponse } from '../types/photo'
import styles from './UnrolledFilm.module.css'

/** 用鍵盤 ← → 一格一格拉時的時間 */
const STEP_MS = 250
/** 拖曳超過幾 px 才算「在拉底片」，以下算點擊 */
const DRAG_THRESHOLD = 4
/** 拉出來：先快後慢 */
const PULL_EASING = 'cubic-bezier(.22,.8,.25,1)'
/** 收回去：先慢後快 */
const RETRACT_EASING = 'cubic-bezier(.5,0,.75,.35)'

interface UnrolledFilmProps {
  roll: FilmRollResponse
  open: boolean
  /** 點進印樣、詳情時帶著的 state（讓那兩頁的返回連結回到底片盒） */
  linkState: unknown
  onOpenPhoto: (photo: PhotoResponse) => void
  /** 在底片條上按 Esc */
  onClose: () => void
}

/**
 * 從底片罐出片口拉出來的底片條，加上漏光與片邊資訊欄。
 *
 * 【影響畫面】底片盒裡的焦點卷期，點罐子或按 Enter 之後。
 *
 * 【「真實」方向】片頭最先出來，所以第 1 格在最外面（右邊），越後面的格越靠近罐子。
 * 想看後面的格就「繼續拉」：拖著底片往右、或按 →，新的格子從出片口冒出來，前面的格子從右邊滑出去。
 *
 * 【怎麼做出「從罐子裡拉出來」】
 * 觀景窗（.window）的左緣貼在出片口，超出左緣的部分看不到 —— 就是還在罐子裡。
 * 整條底片（.track）畫面上由左到右是「最後一格 … 第 2 格、第 1 格、片頭」
 * （DOM 順序剛好相反，用 row-reverse 排，見 frames 的說明），用 translateX 決定露出哪一段：
 *   收起    x = -整條寬度             全部在觀景窗左邊（罐子裡）
 *   剛拉出  x = 觀景窗寬 - 整條寬度     最右邊的片頭與第 1～4 格露出來
 *   拉到底  x = 0                     最後一格貼著出片口
 *
 * 【為什麼位置不放 state】拖曳時每秒會改幾十次位置，每次都 re-render 太浪費。
 * 位置存在 ref，直接改 DOM 的 transform（底片罐轉動也是這樣做的）。React 只負責畫出有哪些格子。
 */
export default function UnrolledFilm({ roll, open, linkState, onOpenPhoto, onClose }: UnrolledFilmProps) {
  const { data: photos } = usePhotos(roll.id)
  const reducedMotion = usePrefersReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  /** 目前的 translateX、可拉動的範圍、觀景窗寬度與一格寬 */
  const posRef = useRef({ x: 0, min: 0, max: 0, winW: 0, cellW: 0 })
  const dragRef = useRef<{ startX: number; startPos: number; pointerId: number; moved: boolean } | null>(null)
  /** 拖完放開時瀏覽器還會補一個 click，用它讓那個 click 不要打開照片（見 handleClickCapture） */
  const suppressClickRef = useRef(false)
  /** 上一次 render 時是開還是關，用來分辨「剛打開／剛收起」與「只是格數變了」 */
  const wasOpenRef = useRef(open)
  /** 上一次排版時有沒有照片：照片剛載入完（從空白底片換成照片）要回到起點，之後格數變動則保留拉到的位置 */
  const hadFramesRef = useRef(false)

  /*
   * 格號由小到大，DOM 裡是「片頭、第 1 格、第 2 格…」，再用 CSS 的 row-reverse 把它們由右往左排。
   * 看起來第 1 格在最右邊（最外面），而 Tab 的順序跟著 DOM，會從第 1 格開始往後走。
   */
  const frames = photos ? [...photos].sort((a, b) => a.frameNumber - b.frameNumber) : []
  const sheetPath = `/film-rolls/${roll.id}/photos`

  /**
   * @param easing 拉出來用「先快後慢」（手一拉、底片滑出來慢慢停下）；
   *   收回用「先慢後快」（RETRACT_EASING，像底片被捲軸捲回去，越捲越快）
   */
  function moveTo(x: number, durationMs: number, clamp = true, easing = PULL_EASING) {
    const pos = posRef.current
    pos.x = clamp ? Math.min(pos.max, Math.max(pos.min, x)) : x
    const track = trackRef.current
    if (!track) return
    const ms = reducedMotion ? 0 : durationMs
    track.style.transition = ms > 0 ? `transform ${ms}ms ${easing}` : 'none'
    track.style.transform = `translateX(${pos.x}px)`
  }

  /**
   * 量出觀景窗該多寬、整條多長，再把底片放到對的位置。
   * 打開、收起、照片載入完成（格數變了）、視窗縮放時都要重做一次。
   */
  function layout(animate: boolean) {
    const win = windowRef.current
    const track = trackRef.current
    if (!win || !track) return
    const firstCell = track.querySelector(`.${styles.cell}`)
    const leader = track.querySelector(`.${styles.leader}`)
    const cellW = firstCell instanceof HTMLElement ? firstCell.offsetWidth : 0
    const trackW = track.scrollWidth
    // 能用的寬度：從出片口到底片盒右緣，留一點邊。
    // getBoundingClientRect 量到的是畫面上的大小，焦點卷期有 scale(1.04)；
    // 寬度卻是設在縮放之前的尺寸上，所以要除以縮放比例換算回來，不然會多出 4%、超出底片盒的邊
    const crate = win.closest('[data-crate-viewport]')
    const right = crate?.getBoundingClientRect().right ?? document.documentElement.clientWidth
    const scale = firstCell instanceof HTMLElement && cellW > 0 ? firstCell.getBoundingClientRect().width / cellW : 1
    const available = (right - win.getBoundingClientRect().left - 16) / scale
    const wanted = VISIBLE_FRAMES * cellW + (leader instanceof HTMLElement ? leader.offsetWidth : 0)
    const winW = Math.max(0, Math.min(wanted, available, trackW))
    win.style.width = `${winW}px`
    // 資訊欄也不能超出底片盒右緣（手機上尤其窄），交給 CSS 用 --avail 限制寬度
    rootRef.current?.style.setProperty('--avail', `${Math.max(0, available)}px`)

    const pos = posRef.current
    pos.min = winW - trackW
    pos.max = 0
    pos.winW = winW
    pos.cellW = cellW
    const hadFrames = hadFramesRef.current
    hadFramesRef.current = frames.length > 0
    if (!open) {
      moveTo(-trackW, animate ? UNROLL_MS : 0, false, RETRACT_EASING)
      return
    }
    if (animate) {
      // 先瞬間放回罐子裡，強制瀏覽器套用（讀一次 offsetWidth），再開動畫拉出來
      moveTo(-trackW, 0, false)
      void track.offsetWidth
      moveTo(pos.min, UNROLL_MS)
    } else if (!hadFrames) {
      // 照片剛載入完：原本露出的是空白底片，換成照片後回到起點（第 1 格在最外面）
      moveTo(pos.min, 0)
    } else {
      // 只是格數變了（例如在放大檢視裡刪了一張）或視窗縮放：留在使用者拉到的位置，只修正超出範圍的部分
      moveTo(pos.x, 0)
    }
  }

  /*
   * useEffectEvent：讓 effect 呼叫「永遠讀到最新 props 的 layout」，又不必把它列進依賴。
   * layout 每次 render 都是新函式，列進依賴的話 effect 每次 render 都會重跑、每次都重播動畫。
   */
  const relayout = useEffectEvent((animate: boolean) => layout(animate))

  // 開關改變：播動畫；照片載入完成（格數改變）：不播動畫，直接重新排好。
  // 用 layout effect：在瀏覽器畫出來之前就把底片放好，不會先閃一下錯的位置
  const frameCount = frames.length
  useLayoutEffect(() => {
    const toggled = wasOpenRef.current !== open
    wasOpenRef.current = open
    relayout(toggled)
    // 拉出來之後鍵盤焦點移到底片條上，← → 和 Esc 馬上能用
    if (toggled && open) windowRef.current?.focus({ preventScroll: true })
  }, [open, frameCount])

  useEffect(() => {
    const onResize = () => relayout(false)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── 拉底片：拖曳、橫向滾輪、← → ──
  // 往右拖 = 繼續拉出來（x 變大）；往左 = 推回去。

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    // 只有主要按鍵（左鍵、觸控、筆）能拉底片；右鍵是叫出選單
    if (!open || event.button !== 0) return
    dragRef.current = { startX: event.clientX, startPos: posRef.current.x, pointerId: event.pointerId, moved: false }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag) return
    // 按鍵已經放開（放開時游標在觀景窗外，pointerup 沒送到這裡）：這次拖曳早就結束了
    if (event.buttons === 0) {
      dragRef.current = null
      return
    }
    const dx = event.clientX - drag.startX
    // 真的拖動了才 capture：一按下就 capture 的話，click 會落在觀景窗上，點不到格子
    if (!drag.moved && Math.abs(dx) > DRAG_THRESHOLD) {
      drag.moved = true
      event.currentTarget.setPointerCapture(drag.pointerId)
    }
    if (drag.moved) moveTo(drag.startPos + dx, 0)
  }

  function handlePointerUp() {
    const drag = dragRef.current
    dragRef.current = null
    if (drag?.moved) suppressClickRef.current = true
  }

  /**
   * 拖完放開時瀏覽器補上的那個 click 在這裡攔下，不讓它打開照片。
   * 用捕獲階段（capture）：click 從外往內傳時先經過觀景窗，不管它最後落在格子上還是觀景窗本身
   * （拖曳時 capture 了 pointer，click 會落在觀景窗）都會經過這裡，旗標一定會被用掉。
   */
  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (!suppressClickRef.current) return
    suppressClickRef.current = false
    event.stopPropagation()
  }

  /**
   * 用 Tab 走到觀景窗外面的格子時，把底片拉到看得到那一格的位置。
   * 觀景窗是 overflow: clip，瀏覽器不會自己捲；不處理的話焦點會停在看不見的格子上。
   */
  function handleFrameFocus(index: number) {
    if (!open) return
    const { x, winW, cellW } = posRef.current
    // 畫面上由左往右數第幾格：row-reverse 讓 DOM 的第 0 格（第 1 格）排在最右邊
    const fromLeft = frames.length - 1 - index
    const left = fromLeft * cellW + x
    if (left < 0) moveTo(-fromLeft * cellW, STEP_MS)
    else if (left + cellW > winW) moveTo(winW - (fromLeft + 1) * cellW, STEP_MS)
  }

  // 只接手橫向滾動（觸控板左右滑、Shift + 滾輪）；直向滾動留給底片盒切換卷期
  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (!open || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
    moveTo(posRef.current.x - event.deltaX, 0)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Alt + ← 是瀏覽器的「上一頁」，Cmd / Ctrl + 方向鍵也有系統用途，不要攔
    if (!open || event.altKey || event.metaKey || event.ctrlKey) return
    const { cellW } = posRef.current
    if (event.key === 'ArrowRight') moveTo(posRef.current.x + cellW, STEP_MS)
    else if (event.key === 'ArrowLeft') moveTo(posRef.current.x - cellW, STEP_MS)
    else if (event.key === 'Escape') onClose()
    else return
    // 處理過的按鍵不要再冒泡到底片盒（底片盒的 Esc、Enter 有別的意思）
    event.preventDefault()
    event.stopPropagation()
  }

  const title = formatRollTitle(roll.filmName, roll.brand)
  const count = photos?.length
  const details = [`ISO ${roll.iso}`, roll.format, count !== undefined && `${count} 張`, roll.camera?.name]
    .filter(Boolean)
    .join(' · ')

  return (
    <div ref={rootRef} className={styles.root} data-open={open || undefined}>
      <div className={styles.leak} aria-hidden="true" />

      <div
        ref={windowRef}
        className={styles.window}
        role="group"
        aria-label={`${title} 的底片條，← → 拉動，Esc 收回`}
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onClickCapture={handleClickCapture}
      >
        <div ref={trackRef} className={styles.track}>
          {/* row-reverse：DOM 第一個（片頭）排在最右邊 */}
          <div className={styles.leader} />
          {frames.length > 0
            ? frames.map((photo, index) => (
                <div key={photo.id} className={styles.cell}>
                  <button
                    type="button"
                    className={styles.frame}
                    tabIndex={open ? 0 : -1}
                    onClick={() => onOpenPhoto(photo)}
                    onFocus={() => handleFrameFocus(index)}
                    aria-label={`第 ${photo.frameNumber} 格，放大檢視`}
                  >
                    <img src={photoUrl(photo.id, 'thumb')} alt="" loading="lazy" draggable={false} />
                  </button>
                  {/* 片邊格號：和印樣一樣，格號粗體、後面的 A 小一點淡一點 */}
                  <span className={styles.edgeNumber} aria-hidden="true">
                    <b>{photo.frameNumber}</b> <span className={styles.edgeNumberA}>▸{photo.frameNumber}A</span>
                  </span>
                </div>
              ))
            : // 還沒有照片（或還在載入）：拉出來的是沒曝光的空白底片
              Array.from({ length: VISIBLE_FRAMES }, (_, i) => (
                <div key={i} className={styles.cell}>
                  <span className={styles.blank} />
                </div>
              ))}
        </div>
      </div>

      {/* 片邊資訊欄：拉出來之後才浮現 */}
      <div className={styles.panel} aria-hidden={!open}>
        <span className={styles.panelText}>
          <strong>{title}</strong> · {details}
        </span>
        <span className={styles.panelLinks}>
          <Link to={sheetPath} state={linkState} tabIndex={open ? 0 : -1}>
            {count === 0 ? '上傳掃描檔 →' : '看全部（印樣）→'}
          </Link>
          <Link to={`/film-rolls/${roll.id}`} state={linkState} tabIndex={open ? 0 : -1}>
            詳情 →
          </Link>
        </span>
      </div>
    </div>
  )
}
