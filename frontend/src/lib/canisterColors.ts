/** SVG 底片罐的一組配色。 */
export interface CanisterColors {
  /** 罐身主色 */
  body: string
  /** 標籤帶的顏色，要和罐身有明顯對比，標籤上的深色字才讀得清楚 */
  label: string
}

/**
 * 把字串轉成一個非負整數（雜湊值）。
 *
 * 【影響畫面】沒有外觀照片的卷期，SVG 底片罐的顏色由這個數字決定。
 *   同一個底片名稱永遠得到同一個數字，所以同款底片每次、每一卷都是同一個顏色。
 *
 * 【預期結果】
 *   hashString('Kodak Portra 400') === hashString('Kodak Portra 400')   同樣的輸入永遠一樣
 *   hashString('Kodak Portra 400') !== hashString('Kodak Portra 160')   只差一個字也不同（通常）
 *   hashString('') >= 0                                                  永遠非負
 *
 * 【會用到】（內建，不用 import）
 *   - `str.charCodeAt(i)`：第 i 個字元的編碼
 *   - `Math.imul(a, b)`：32 位元整數乘法，不會變成超大的浮點數
 *   - `>>> 0`：把結果轉成 0 ~ 4294967295 的非負整數
 *
 * 【步驟】
 * 0. 刪掉 `void value` 與 `return 0` 佔位。
 * 1. `let hash = 0`
 * 2. 逐字元：`hash = Math.imul(hash, 31) + value.charCodeAt(i)`
 *    （這是 Java `String.hashCode()` 同一套算法，31 是慣用的小質數）
 * 3. 迴圈結束後 `return hash >>> 0`
 *
 * 【坑】不用 `Math.imul` 直接寫 `hash * 31`：字串稍長時數字會超過 2^53，失去整數精度，
 *   JavaScript 不會報錯，只是算出來的值開始「看起來隨機但其實不穩定」。
 *   不加 `>>> 0` 的話結果可能是負數，後面 `% 360` 會得到負的色相。
 */
export function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(hash, 31) + value.charCodeAt(i)
  }
  return hash >>> 0
}

/**
 * 依底片名稱產生底片罐的配色。
 *
 * 【影響畫面】同上。
 *
 * 【預期結果】
 *   canisterColors('Kodak Portra 400') → { body: 'hsl(217 55% 42%)', label: 'hsl(217 35% 88%)' }
 *   （實際的色相數字依你的雜湊結果而定；重點是 body 深、label 淺，同一個 seed 永遠一樣）
 *
 * 【會用到】`hashString`（同一個檔案）
 *
 * 【步驟】
 * 0. 刪掉 `void seed` 與佔位的回傳值。
 * 1. `const hue = hashString(seed) % 360`：0 ~ 359 的色相。
 * 2. 飽和度、亮度固定，只讓色相變化：
 *    body  `` `hsl(${hue} 55% 42%)` ``
 *    label `` `hsl(${hue} 35% 88%)` ``
 *
 * 【為什麼固定飽和度與亮度】色相完全隨機時，整排底片罐的明暗一致，看起來是同一個系列；
 *   連亮度都隨機的話，有的罐子幾乎是黑的、有的刺眼，標籤字也可能讀不到。
 * 【可以想一下】seed 要傳什麼？傳 `filmName` 的話，Kodak Gold 200 和 Fujifilm Gold 200 會同色；
 *   傳 `formatRollTitle(filmName, brand)` 就會分開。呼叫端（RollArtwork）決定。
 */
export function canisterColors(seed: string): CanisterColors {
  const hue = hashString(seed) % 360
  return {
    body: `hsl(${hue} 55% 42%)`,
    label: `hsl(${hue} 35% 88%)`,
  }
}
