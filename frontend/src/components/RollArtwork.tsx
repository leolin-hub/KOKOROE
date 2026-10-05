import FilmCanisterSvg from './FilmCanisterSvg'
import type { FilmRollResponse } from '../types/filmRoll'
import styles from './RollArtwork.module.css'
import { labelFilmName } from '../lib/filmStockKey'
import { canisterPalette } from '../lib/canisterColors'
import { guessFilmType } from '../lib/filmType'
import { dxCode } from '../lib/dxCode'

interface RollArtworkProps {
  roll: FilmRollResponse
  /** 焦點卷期：底片罐加上顆粒，滑鼠移上去會轉動。 */
  focused?: boolean
  /** 底片條已經拉出來（底片盒的攤開動畫）：罐子藏起自己的片頭、不轉 */
  unrolled?: boolean
}

/**
 * 一卷底片的外觀：寫實的 SVG 底片罐，配色、文字、片頭顏色都從這卷的資料算出來。
 *
 * 【影響畫面】唱片櫃瀏覽頁（/crate）每一格左側的底片罐。之後步驟 3 有沖洗照片時，也會改由這裡決定封面。
 *
 * 以前這裡會先找外觀照片、找不到才畫 SVG；改成每一卷都畫底片罐之後照片就不用了：
 * 照片（多半是廠商的商品照）和畫出來的罐子排在一起風格不一致，放進公開的 repo 也有版權疑慮。
 *
 * 這支只負責「準備資料」，每一項都交給一支 lib 函式：
 *   labelFilmName   片名拿掉重複的品牌與 ISO        lib/filmStockKey.ts
 *   canisterPalette 三層配色：款式 → 品牌 → 雜湊     lib/canisterColors.ts  ← 你來寫
 *   guessFilmType   從片名推測彩色／黑白／正片       lib/filmType.ts        ← 你來寫
 *   dxCode          罐身背面的 DX 格子               lib/dxCode.ts          ← 你來寫
 * 那三支還沒寫的時候，罐子一樣畫得出來：配色都是同一組、片頭都是彩色負片、DX 格子全黑。
 */
export default function RollArtwork({ roll, focused = false, unrolled = false }: RollArtworkProps) {
  // 後端與表單都沒有 trim 品牌，' Kodak ' 會原樣存進來。在這裡統一整理一次，後面的函式都拿到乾淨的值；
  // 只有空白的品牌當作沒有品牌（否則罐子上會印出一行空白）
  const brand = roll.brand?.trim() || undefined
  const name = labelFilmName(brand, roll.filmName, roll.iso)

  return (
    <div className={styles.artwork}>
      <FilmCanisterSvg
        brand={brand}
        name={name}
        iso={roll.iso}
        format={roll.format}
        palette={canisterPalette(brand, name, roll.iso)}
        filmType={guessFilmType(brand, roll.filmName)}
        dx={dxCode(roll.iso)}
        focused={focused}
        unrolled={unrolled}
      />
    </div>
  )
}
