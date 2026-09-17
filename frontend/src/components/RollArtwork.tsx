import FilmCanisterSvg from './FilmCanisterSvg'
import type { FilmRollResponse } from '../types/filmRoll'
import styles from './RollArtwork.module.css'

interface RollArtworkProps {
  roll: FilmRollResponse
}

/**
 * 一卷底片的外觀：有照片用照片，沒有就畫 SVG 底片罐。
 *
 * 【影響畫面】唱片櫃瀏覽頁（/crate）每一格左側的大圖。之後步驟 3 有沖洗照片時，也會改由這裡決定封面。
 *
 * 【會用到】
 *   - `useState`                                   'react'                  ← 要自己 import
 *   - `findFilmStockImage(brand, filmName)`         '../lib/filmStockImage'  ← 要自己 import
 *   - `canisterColors(seed)`                        '../lib/canisterColors'  ← 要自己 import
 *   - `formatRollTitle(filmName, brand)`            '../lib/format'          ← 要自己 import
 *   - `FilmCanisterSvg`、`styles.artwork`、`styles.photo`（已 import）
 *
 * 【步驟】
 * 1. 把參數改成解構：`export default function RollArtwork({ roll }: RollArtworkProps)`，刪掉 `void props`。
 * 2. 查照片：`const imageUrl = findFilmStockImage(roll.brand, roll.filmName)`
 * 3. 記住「照片載入失敗」：`const [imageFailed, setImageFailed] = useState(false)`
 *    對照表說有，但檔案可能被刪掉或檔名打錯；這時要退回 SVG，而不是顯示一個破圖示。
 * 4. 有照片且沒失敗時：
 *    ```tsx
 *    <div className={styles.artwork}>
 *      <img
 *        className={styles.photo}
 *        src={imageUrl}
 *        alt={`${title} 底片捲`}
 *        loading="lazy"
 *        onError={() => setImageFailed(true)}
 *      />
 *    </div>
 *    ```
 *    其中 `const title = formatRollTitle(roll.filmName, roll.brand)`。
 * 5. 否則畫底片罐：
 *    - `const colors = canisterColors(title)`
 *    - `<FilmCanisterSvg bodyColor={colors.body} labelColor={colors.label} title={...} subtitle={`ISO ${roll.iso}`} />`
 *    - title 用品牌，沒有品牌時用底片名稱：`roll.brand ?? roll.filmName`
 *    - 一樣包在 `<div className={styles.artwork}>` 裡，兩種外觀的外框大小才會一致。
 *
 * 【坑】
 * - `loading="lazy"`：唱片櫃一次載入 20 卷，看不到的那些先不下載圖片。
 * - `alt` 不能省，也不要寫「圖片」這種沒資訊的字；螢幕閱讀器使用者要知道這是哪一卷。
 * - `imageFailed` 是這個元件自己的 state：如果同一個 RollArtwork 換成顯示另一卷，舊的失敗狀態會殘留。
 *   唱片櫃用 `key={roll.id}` 渲染，換卷就是換一個元件，所以不會發生；但要知道這個前提。
 */
export default function RollArtwork(props: RollArtworkProps) {
  void props
  return (
    <div className={styles.artwork}>
      <FilmCanisterSvg bodyColor="hsl(30 20% 40%)" labelColor="hsl(30 20% 85%)" title="TODO" subtitle="RollArtwork" />
    </div>
  )
}
