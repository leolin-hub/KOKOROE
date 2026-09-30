/**
 * 底片款式的名稱整理：查表用的 key，以及印在罐子標籤上的片名。
 *
 * 以前這裡還有一張「底片 → 照片檔名」的對照表；唱片櫃改成畫 SVG 底片罐後照片就不用了，
 * 對照表拿掉，`toFilmStockKey` 留下來給 `lib/canisterColors.ts` 查配色用。
 */

/**
 * 把品牌與底片名稱轉成大駝峰的查詢 key。
 *
 * 【影響畫面】唱片櫃每一卷底片罐的配色：key 對上 `STOCK_PALETTES` 才會用那款底片自己的顏色。
 *
 * 【預期結果】
 *   toFilmStockKey('Kodak', 'Portra 400')           → 'KodakPortra400'
 *   toFilmStockKey('kodak', 'portra 400')           → 'KodakPortra400'
 *   toFilmStockKey('Fujifilm', 'Superia X-TRA 400') → 'FujifilmSuperiaXTRA400'
 *   toFilmStockKey(undefined, 'Gold 200')           → 'Gold200'
 *   toFilmStockKey('Ilford', 'HP5 Plus')            → 'IlfordHP5Plus'
 *
 * 【會用到】（都是內建的，不用 import）
 *   - `String.prototype.split(regex)`、`Array.prototype.filter`、`map`、`join`
 *   - `str.charAt(0).toUpperCase() + str.slice(1)`：只把第一個字母變大寫，其餘保持原樣
 *
 * 【步驟】
 * 1. 把品牌與名稱接成一個字串：`` `${brand ?? ''} ${filmName}` ``
 * 2. 用「不是字母也不是數字」的字元切開：`.split(/[^\p{L}\p{N}]+/u)`
 *    - `\p{L}` 是任何語言的字母、`\p{N}` 是數字，結尾的 `u` 旗標是用 `\p{...}` 的必要條件。
 *    - 用 `[^A-Za-z0-9]` 的話，中文名稱會整個被切掉。
 *    - 空白、`-`、`/` 都會變成切點，所以 `X-TRA` 會切成 `X`、`TRA`。
 * 3. `.filter(Boolean)` 去掉空字串：字串開頭是分隔字元時（例如沒有品牌時的前導空白），split 會產生 `''`。
 * 4. 每一段的第一個字元轉大寫、其餘不動，再 `.join('')`。
 *
 * 【坑】不要把其餘字元轉小寫：`HP5` 會變成 `Hp5`。
 *   大小寫不一致（使用者輸入 `portra`）交給查表的一方用不分大小寫的比對處理。
 * 【可以想一下】品牌與名稱直接接起來、不留分隔，所以 `('Kodak', 'Gold 200')` 與 `('KodakGold', '200')`
 *   會得到同一個 key。對照表只有幾十款、名稱都是真的底片時撞不到；表變大時再考慮保留分隔。
 */
export function toFilmStockKey(brand: string | undefined, filmName: string): string {
  const key = `${brand ?? ''} ${filmName}`
  const keySplit = key.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  const keyCamel = keySplit.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('')
  return keyCamel
}

/**
 * 印在罐子標籤上的片名：拿掉開頭重複的品牌與結尾的 ISO。
 *
 * 使用者輸入片名的習慣不一定：`Portra`、`Portra 400`、`Kodak Portra 400` 都有可能。
 * 標籤上品牌、ISO 各有自己的位置，片名再帶一次就重複了。
 *
 *   labelFilmName('Kodak', 'Portra 400', 400)       → 'Portra'
 *   labelFilmName('Kodak', 'Kodak Portra 400', 400) → 'Portra'
 *   labelFilmName('Ilford', 'HP5 Plus', 400)        → 'HP5 Plus'
 *   labelFilmName('Fujifilm', '200', 200)           → '200'    （拿完變空字串時，退回原本的片名）
 */
export function labelFilmName(brand: string | undefined, filmName: string, iso: number): string {
  const original = filmName.trim()
  let name = original
  if (brand && name.toLowerCase().startsWith(`${brand.toLowerCase()} `)) {
    name = name.slice(brand.length).trim()
  }
  name = name.replace(new RegExp(`\\s*${iso}$`), '').trim()
  return name || original
}
