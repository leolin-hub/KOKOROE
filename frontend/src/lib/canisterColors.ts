/**
 * 底片罐標籤的配色。
 *
 * 用的是「色帶」版型：上半部是底色（base），下半部一條重點色帶（accent）放大大的 ISO。
 * 每一組配色都要成對給字的顏色：ink 印在 base 上、accentInk 印在 accent 上，兩者都要讀得清楚。
 *
 * 為什麼分三層查，而不是全部用雜湊算：
 *   1. 常見的底片（Portra、Gold）使用者一眼就認得包裝的顏色，用它自己的配色最有「就是這卷」的感覺。
 *   2. 同品牌但表裡沒收錄的款式（例如 Ilford 的某一款），至少還是同一個品牌的色調。
 *   3. 完全沒看過的底片，才從固定的幾組裡用雜湊挑一組：同一個名字永遠同一組，而且不會出現刺眼的顏色。
 * 代價是配色表要手動維護。之後有了 `film_stock` 目錄（路線圖步驟 4），配色應該搬到那裡跟著底片款式存。
 *
 * 配色是向包裝致敬，不是照抄：只借顏色，不放 logo、不複製包裝排版。
 */

export interface CanisterPalette {
  /** 標籤上半部的底色 */
  base: string
  /** 下半部色帶的顏色 */
  accent: string
  /** 印在 base 上的字（品牌、片名、背面小字） */
  ink: string
  /** 印在 accent 上的字（ISO） */
  accentInk: string
}

/** 第一層：特定款式。key 是 `toFilmStockKey(brand, `${片名} ${iso}`)` 的結果。 */
export const STOCK_PALETTES: Readonly<Record<string, CanisterPalette>> = {
  KodakPortra400: { base: '#e6cd98', accent: '#5b3f6e', ink: '#2a1d2e', accentInk: '#f3e7cf' },
  KodakGold200: { base: '#f2b62c', accent: '#a8321e', ink: '#2b1a0f', accentInk: '#fde9b8' },
  KodakUltraMax400: { base: '#2d5a94', accent: '#f0b429', ink: '#f4efe4', accentInk: '#1b2436' },
  KodakColorPlus200: { base: '#d9492e', accent: '#f2c230', ink: '#fff3e2', accentInk: '#3a1a10' },
  KentmerePan200: { base: '#86a13b', accent: '#44703b', ink: '#f6f4e6', accentInk: '#f6f4e6' },
}

/** 第二層：品牌。key 一律小寫。 */
export const BRAND_PALETTES: Readonly<Record<string, CanisterPalette>> = {
  ilford: { base: '#e7e3da', accent: '#161514', ink: '#161514', accentInk: '#e7e3da' },
  fujifilm: { base: '#2f7a4d', accent: '#e9e4d6', ink: '#f2f0e6', accentInk: '#1d3a28' },
  lomography: { base: '#1c1b1d', accent: '#c7a2d8', ink: '#f0ece6', accentInk: '#1c1b1d' },
}

/** 第三層：表裡都沒有時，從這幾組挑一組。刻意都是低彩度、和暗房背景搭得起來的顏色。 */
export const FALLBACK_PALETTES: readonly CanisterPalette[] = [
  { base: '#c2553b', accent: '#2c2522', ink: '#fbeee4', accentInk: '#f3d9c9' },
  { base: '#2f6b6b', accent: '#e0c28a', ink: '#f1ece0', accentInk: '#23302f' },
  { base: '#8a6b3a', accent: '#1f1a14', ink: '#f7eedf', accentInk: '#e9d6b3' },
  { base: '#3b4a63', accent: '#d9a441', ink: '#eef0f2', accentInk: '#1d2330' },
]

/**
 * 把字串轉成一個非負整數（雜湊值）。
 *
 * 【影響畫面】表裡沒有的底片，罐子用 `FALLBACK_PALETTES` 的哪一組，由這個數字決定。
 *   同一個底片名稱永遠得到同一個數字，所以同款底片每次、每一卷都是同一組顏色。
 *
 * 【預期結果】
 *   hashString('Kodak Portra 400') === hashString('Kodak Portra 400')   同樣的輸入永遠一樣
 *   hashString('Kodak Portra 400') !== hashString('Kodak Portra 160')   只差一個字也不同（通常）
 *   hashString('') >= 0                                                  永遠非負
 *
 * 【坑】不用 `Math.imul` 直接寫 `hash * 31`：字串稍長時數字會超過 2^53，失去整數精度，
 *   JavaScript 不會報錯，只是算出來的值開始「看起來隨機但其實不穩定」。
 *   不加 `>>> 0` 的話結果可能是負數，後面取餘數會得到負的索引。
 */
export function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(hash, 31) + value.charCodeAt(i)
  }
  return hash >>> 0
}

/**
 * 依底片款式決定罐子的配色：先查款式、再查品牌、都沒有就用雜湊挑一組。
 *
 * 【影響畫面】唱片櫃（/crate）每一卷底片罐的標籤顏色。由 `RollArtwork` 呼叫，
 *   傳進來的 `name` 已經用 `labelFilmName` 拿掉重複的品牌與 ISO（例如 `'Portra'`）。
 *
 * 【預期結果】
 *   canisterPalette('Kodak', 'Portra', 400)      → STOCK_PALETTES.KodakPortra400         （第一層）
 *   canisterPalette('kodak', 'portra', 400)      → STOCK_PALETTES.KodakPortra400         （大小寫不同也要對上）
 *   canisterPalette('Ilford', 'HP5 Plus', 400)   → BRAND_PALETTES.ilford                 （第二層）
 *   canisterPalette('ILFORD', 'Delta', 100)      → BRAND_PALETTES.ilford                 （品牌大小寫也不管）
 *   canisterPalette('Hikari', 'Aurora', 800)     → FALLBACK_PALETTES 裡的某一組，每次都同一組（第三層）
 *   canisterPalette(undefined, 'Mystery', 200)   → FALLBACK_PALETTES 裡的某一組（沒有品牌也不能壞）
 *
 * 【會用到】
 *   - `toFilmStockKey(brand, filmName)`       './filmStockKey'（同一個 lib 資料夾）  ← 要自己 import
 *   - `STOCK_PALETTES`、`BRAND_PALETTES`、`FALLBACK_PALETTES`、`hashString`（同一個檔案）
 *   - `Object.entries(obj).find(([key]) => ...)`（內建）：在物件裡找符合條件的那一筆，回傳 `[key, value]` 或 `undefined`
 *   - `a ?? b`（內建）：a 是 `undefined` / `null` 時才用 b
 *
 * 【步驟】
 * 0. 刪掉 `void` 三行與 `return FALLBACK_PALETTES[0]` 佔位。
 * 1. 第一層：`const stockKey = toFilmStockKey(brand, `${name} ${iso}`).toLowerCase()`，
 *    在 `Object.entries(STOCK_PALETTES)` 裡找 key 轉小寫後等於 `stockKey` 的那一筆；找到就回傳它的配色。
 *    （和你之前寫的 `findFilmStockImage` 是同一招。）
 * 2. 第二層：有品牌的話，`BRAND_PALETTES[brand.toLowerCase()]`；有值就回傳。
 * 3. 第三層：`FALLBACK_PALETTES[hashString(...) % FALLBACK_PALETTES.length]`。
 *    雜湊的輸入要包含什麼？（提示：只用 name 的話，不同品牌的同名底片會同色）
 *
 * 【坑】
 * - 第一層直接寫 `STOCK_PALETTES[stockKey]` 只能大小寫完全相同才對得上，使用者輸入 `portra` 就找不到。
 * - 第二層的 `brand` 可能是 `undefined`，直接 `brand.toLowerCase()` 會 crash（TypeScript 會先擋下來）。
 * - 第一層查不到時 `find` 回傳 `undefined`，要先判斷再取 `[1]`，不然會讀 `undefined[1]` 出錯。
 *
 * 【可以想一下】第二層只看品牌，所以 Ilford 旗下所有底片都同色。之後有 `film_stock` 目錄時，
 *   配色會跟著款式存在資料庫，這三層就只剩「目錄裡沒有」時的最後一層。
 */
export function canisterPalette(brand: string | undefined, name: string, iso: number): CanisterPalette {
  void brand
  void name
  void iso
  return FALLBACK_PALETTES[0]
}
