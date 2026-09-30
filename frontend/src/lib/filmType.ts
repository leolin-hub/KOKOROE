/**
 * 從品牌與片名推測底片種類：彩色負片、黑白、正片（幻燈片）。
 *
 * 卷期資料目前沒有「底片種類」這個欄位，但罐子需要它：
 *   - 片頭的顏色：彩色負片的片基是橘棕色、黑白是灰黑色、正片是透明偏灰。
 *   - 罐子背面的小字：`COLOR NEGATIVE FILM / PROCESS C-41`、`BLACK & WHITE FILM` 之類。
 * 推測一定會有猜錯的時候；之後有 `film_stock` 目錄（路線圖步驟 4）時，種類跟著款式存進資料庫，這支就只剩後備用途。
 */

export type FilmType = 'color' | 'bw' | 'slide'

/** 片名裡出現這些字就是黑白片（一律小寫）。 */
export const BW_KEYWORDS: readonly string[] = [
  'hp5', 'fp4', 'delta', 'pan', 'tri-x', 'trix', 't-max', 'tmax', 'acros',
  'rpx', 'lady grey', 'berlin', 'double-x', 'ortho', 'xp2',
]

/** 片名裡出現這些字就是正片（一律小寫）。 */
export const SLIDE_KEYWORDS: readonly string[] = ['ektachrome', 'velvia', 'provia', 'e100', 'slide']

/** 幾乎只出黑白片的品牌（一律小寫）。 */
export const BW_BRANDS: readonly string[] = ['ilford', 'kentmere', 'foma', 'adox']

/**
 * 推測底片種類。
 *
 * 【影響畫面】唱片櫃每一卷底片罐的片頭顏色與背面小字。由 `RollArtwork` 呼叫。
 *
 * 【預期結果】
 *   guessFilmType('Kodak', 'Portra 400')              → 'color'   （什麼都沒對上，預設彩色負片）
 *   guessFilmType('Ilford', 'HP5 Plus')               → 'bw'      （片名關鍵字）
 *   guessFilmType('Kodak', 'Tri-X 400')               → 'bw'      （同一個品牌也有黑白片，所以要看片名）
 *   guessFilmType('Kentmere', '200')                  → 'bw'      （片名沒線索，靠品牌）
 *   guessFilmType('Fujifilm', 'Velvia 50')            → 'slide'
 *   guessFilmType('Ilford', 'Ilfocolor 400')          → 'color'   （黑白品牌出的彩色片：品牌規則的例外）
 *   guessFilmType('Lomography', 'LomoChrome Metropolis') → 'color' （見【坑】）
 *   guessFilmType(undefined, 'Mystery 200')           → 'color'
 *
 * 【會用到】（都是內建的，不用 import）
 *   - `str.toLowerCase()`、`str.includes(sub)`
 *   - `array.some((x) => ...)`：陣列裡只要有一個符合就回傳 true
 *   - `BW_KEYWORDS`、`SLIDE_KEYWORDS`、`BW_BRANDS`（同一個檔案）
 *
 * 【步驟】
 * 0. 刪掉 `void` 兩行與 `return 'color'` 佔位。
 * 1. 片名轉小寫：`const name = filmName.toLowerCase()`
 * 2. 片名含 `SLIDE_KEYWORDS` 任一個 → `'slide'`。
 * 3. 片名含 `BW_KEYWORDS` 任一個 → `'bw'`。
 * 4. 品牌在 `BW_BRANDS` 裡 → `'bw'`……但 `Ilfocolor` 怎麼辦？（提示：品牌規則之前先看片名有沒有 `color`）
 * 5. 都沒有 → `'color'`。
 *
 * 【坑】
 * - 順序很重要：先看片名、後看品牌。片名是「這一款」的資訊，品牌只是「大多數」。
 * - 不要把 `chrome` 當成正片關鍵字：Lomography 的 LomoChrome 系列其實是 C-41 彩色負片，
 *   加了 `chrome` 會把它們全部判成正片。`ektachrome` 夠長，不會誤判。
 * - `pan` 很短，`includes('pan')` 會誤中任何含 pan 的字（例如虛構的 `Panorama Color 200`）。
 *   目前可以接受；想更準的話，改成比對「整個字」：`name.split(/\s+/)` 後再看有沒有等於 `pan` 的那一段。
 *
 * 【可以想一下】Ilford XP2 是黑白影像，但要用 C-41（彩色負片）的藥水沖洗。
 *   罐子上該印 `BLACK & WHITE` 還是 `C-41`？真實的包裝兩個都印。三種類型不夠表達時，就是該把種類存進資料庫的時候。
 */
export function guessFilmType(brand: string | undefined, filmName: string): FilmType {
  void brand
  void filmName
  return 'color'
}
