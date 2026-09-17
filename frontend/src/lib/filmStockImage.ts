/**
 * 底片捲外觀圖片的對照表與查詢。
 *
 * 圖片放在 `frontend/public/film-stocks/`，網址是 `/film-stocks/<檔名>`
 * （public 裡的檔案會原封不動地放在網站根目錄，不經過 Vite 打包）。
 *
 * 為什麼要一張手寫的對照表，而不是直接用 `<img src="/film-stocks/KodakPortra400.webp">` 試試看：
 * 1. 副檔名不固定（.webp / .png / .jpg），猜不到。
 * 2. 找不到圖時瀏覽器會先發一個 404 才進 onError，唱片櫃一次 20 卷就是 20 個 404。
 * 對照表讓「有沒有這張圖」在發請求之前就知道。代價是新增圖片時要來這裡加一行。
 */

/**
 * 已經放進 `public/film-stocks/` 的圖片。
 *
 * key：`toFilmStockKey(brand, filmName)` 算出來的名稱（大駝峰）。
 * value：實際檔名（含副檔名）。
 *
 * 新增圖片的流程：
 *   1. 把檔案以大駝峰命名放進 `public/film-stocks/`，例如 `KodakPortra400.webp`
 *   2. 在下面加一行 `KodakPortra400: 'KodakPortra400.webp',`
 */
export const FILM_STOCK_IMAGES: Readonly<Record<string, string>> = {
  // KodakPortra400: 'KodakPortra400.webp',
}

/**
 * 把品牌與底片名稱轉成大駝峰的查詢 key。
 *
 * 【影響畫面】唱片櫃每一卷的外觀：key 對上 `FILM_STOCK_IMAGES` 才會顯示照片，否則顯示 SVG 底片罐。
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
 * 0. 開始寫時，先刪掉函式裡的 `void` 兩行與 `return ''`（那只是讓骨架能通過型別檢查的佔位）。
 * 1. 把品牌與名稱接成一個字串：`` `${brand ?? ''} ${filmName}` ``
 * 2. 用「不是字母也不是數字」的字元切開：`.split(/[^\p{L}\p{N}]+/u)`
 *    - `\p{L}` 是任何語言的字母、`\p{N}` 是數字，結尾的 `u` 旗標是用 `\p{...}` 的必要條件。
 *    - 用 `[^A-Za-z0-9]` 的話，中文名稱會整個被切掉。
 *    - 空白、`-`、`/` 都會變成切點，所以 `X-TRA` 會切成 `X`、`TRA`。
 * 3. `.filter(Boolean)` 去掉空字串：字串開頭是分隔字元時（例如沒有品牌時的前導空白），split 會產生 `''`。
 * 4. 每一段的第一個字元轉大寫、其餘不動，再 `.join('')`。
 *
 * 【坑】不要把其餘字元轉小寫：`HP5` 會變成 `Hp5`，而你的檔名是照品牌原本的寫法命名的。
 *   大小寫不一致（使用者輸入 `portra`）交給下面的 `findFilmStockImage` 用不分大小寫的比對處理。
 */
export function toFilmStockKey(brand: string | undefined, filmName: string): string {
  void brand
  void filmName
  return ''
}

/**
 * 查這卷底片有沒有外觀圖片，有的話回傳圖片網址。
 *
 * 【影響畫面】同上，由 `RollArtwork` 呼叫。
 *
 * 【預期結果】（假設對照表有 `KodakPortra400: 'KodakPortra400.webp'`）
 *   findFilmStockImage('Kodak', 'Portra 400') → '/film-stocks/KodakPortra400.webp'
 *   findFilmStockImage('KODAK', 'PORTRA 400') → '/film-stocks/KodakPortra400.webp'
 *   findFilmStockImage('Kodak', 'Gold 200')   → undefined
 *
 * 【會用到】
 *   - `toFilmStockKey`（同一個檔案）
 *   - `Object.entries(FILM_STOCK_IMAGES)` 與 `Array.prototype.find`
 *
 * 【步驟】
 * 0. 刪掉 `void` 兩行與 `return undefined` 佔位。
 * 1. `const key = toFilmStockKey(brand, filmName).toLowerCase()`
 * 2. 在 `Object.entries(FILM_STOCK_IMAGES)` 裡找 `name.toLowerCase() === key` 的那一筆。
 * 3. 找到就回傳 `` `/film-stocks/${fileName}` ``，找不到回傳 `undefined`。
 *
 * 【坑】直接寫 `FILM_STOCK_IMAGES[key]` 只能做大小寫完全相同的比對，
 *   使用者輸入 `kodak portra 400` 就找不到。
 * 【可以想一下】每次呼叫都掃一遍對照表，一次 render 20 卷就掃 20 遍。
 *   對照表只有幾十筆時完全沒差；真的變大時，可以在 module 層先建一次「小寫 key → 檔名」的 Map。
 */
export function findFilmStockImage(brand: string | undefined, filmName: string): string | undefined {
  void brand
  void filmName
  return undefined
}
