import type { CSSProperties } from 'react'
import { photoUrl } from '../api/photos'
import type { FilmFormat } from '../types/filmRoll'
import type { PhotoResponse } from '../types/photo'
import styles from './ContactSheet.module.css'

/**
 * 每條底片放幾格。沖印店剪底片的慣例：135 一條 6 格，120（6×6）一條 3 格。
 * 印樣就是把剪好的底片條一條條排在相紙上直接曬出來，所以版面跟著這個數字走。
 */
const FRAMES_PER_STRIP: Record<FilmFormat, number> = {
  '135': 6,
  '120': 3,
}

interface ContactSheetProps {
  photos: readonly PhotoResponse[]
  format: FilmFormat
  /** 印在片邊的字，例如「KODAK PORTRA 400」 */
  edgeLabel: string
  onOpen: (photo: PhotoResponse) => void
}

/**
 * 印樣（contact sheet）：底片條排在相紙上，一格一張縮圖。
 *
 * 【影響畫面】印樣頁（/film-rolls/:id/photos）的主體。
 *
 * 【幾個刻意的設計】
 * - 每格的框是固定比例（135 是 3:2、120 是 1:1），照片用 `object-fit: contain` 放進去。
 *   直拍的照片會在框裡左右留黑，和真的底片一樣（底片上每一格都是橫的，直拍只是相機轉了 90°）。
 * - 只排有上傳的照片，依格號順序；片邊印的是真正的格號，所以中間跳號也看得出來。
 * - 最後一條不滿 6 格時，那一條就短一點，不拉長：剪下來的最後一段底片本來就比較短。
 * - 每一格是 `<button>`：鍵盤 Tab 得到、Enter 打開，螢幕閱讀器會念「第 7 格」。
 * - 縮圖 `loading="lazy"`：捲到附近才下載，一卷 36 張不會一進頁面就全部同時抓。
 * - 片孔與片邊文字是裝飾，`aria-hidden` 不讓螢幕閱讀器念。
 */
export default function ContactSheet({ photos, format, edgeLabel, onOpen }: ContactSheetProps) {
  const perStrip = FRAMES_PER_STRIP[format]
  const strips: PhotoResponse[][] = []
  for (let i = 0; i < photos.length; i += perStrip) {
    strips.push(photos.slice(i, i + perStrip))
  }

  return (
    <>
      <div className={styles.paper}>
        <div className={styles.sheet} data-format={format}>
          {strips.map((strip) => (
            <div
              key={strip[0].id}
              className={styles.strip}
              // CSS 變數：這一條有幾格、滿的一條是幾格，CSS 用它們算寬度與欄數
              style={{ '--frames': strip.length, '--per-strip': perStrip } as CSSProperties}
            >
              {/*
                底片名稱每兩格印一次、橫跨兩格的寬度：每格都印的話，名稱一長就會擠進隔壁那格。
                最後一段只剩一格時就只跨一格。
              */}
              <div className={`${styles.edge} ${styles.edgeTop}`} aria-hidden="true">
                {strip.map((photo, i) =>
                  i % 2 === 0 ? (
                    <span
                      key={photo.id}
                      className={styles.edgeName}
                      style={{ gridColumn: `span ${Math.min(2, strip.length - i)}` }}
                    >
                      {edgeLabel}
                    </span>
                  ) : null,
                )}
              </div>

              <ul className={styles.frames}>
                {strip.map((photo) => (
                  <li key={photo.id} className={styles.frame}>
                    <button
                      type="button"
                      className={styles.frameButton}
                      onClick={() => onOpen(photo)}
                      aria-label={`第 ${photo.frameNumber} 格，放大檢視`}
                    >
                      <img
                        src={photoUrl(photo.id, 'thumb')}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className={styles.image}
                      />
                    </button>
                  </li>
                ))}
              </ul>

              <div className={`${styles.edge} ${styles.edgeBottom}`} aria-hidden="true">
                {strip.map((photo) => (
                  <span key={photo.id} className={styles.edgeNumber}>
                    <span className={styles.frameNumber}>{photo.frameNumber}</span>
                    <span className={styles.frameNumberA}>▸{photo.frameNumber}A</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className={styles.scrollHint}>← 左右滑動看完整印樣 →</p>
    </>
  )
}
