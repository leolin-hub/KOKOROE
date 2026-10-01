/**
 * 從品牌與片名推測底片種類：彩色負片、黑白、正片（幻燈片）。
 *
 * 卷期資料目前沒有「底片種類」這個欄位，但罐子需要它：
 *   - 片頭的顏色：彩色負片的片基是橘棕色、黑白是灰黑色、正片是透明偏灰。
 *   - 罐子背面的小字：`COLOR NEGATIVE FILM / PROCESS C-41`、`BLACK & WHITE FILM` 之類。
 * 推測一定會有猜錯的時候；之後有 `film_stock` 目錄（路線圖步驟 4）時，種類跟著款式存進資料庫，這支就只剩後備用途。
 */

export type FilmType = 'color' | 'bw' | 'slide'

/*
 * 關鍵字比對的是「整個字」，不是字串包含：`pan` 只認得 `Pan F Plus` 的 Pan，不會誤中 Japan、Panorama、Expansion。
 * 所以關鍵字一律寫成 `toWords` 處理後的樣子：小寫、標點換成空白（`Tri-X` → `tri x`）。
 * 品牌名本身就是一個字的黑白片（StreetPan、Fomapan、Panatomic-X）要整個字列進來。
 */

/** 片名裡出現這些字就是黑白片。 */
export const BW_KEYWORDS: readonly string[] = [
  'hp5', 'fp4', 'delta', 'pan', 'tri x', 'trix', 't max', 'tmax', 'plus x', 'panatomic',
  'acros', 'rpx', 'retro', 'apx', 'fomapan', 'streetpan', 'lady grey', 'berlin', 'double x',
  'ortho', 'xp2', 'bw400cn',
]

/** 片名裡出現這些字就是正片。 */
export const SLIDE_KEYWORDS: readonly string[] = [
  'ektachrome', 'kodachrome', 'elite chrome', 'aerochrome', 'velvia', 'provia', 'e100',
]

/** 幾乎只出黑白片的品牌。 */
export const BW_BRANDS: readonly string[] = ['ilford', 'kentmere', 'foma', 'fomapan', 'adox']

/** `'Tri-X 400'` → `' tri x 400 '`：前後各留一個空白，比對 `` ` ${關鍵字} ` `` 就是「整個字」。 */
function toWords(text: string): string {
  return ` ${text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).join(' ')} `
}

/**
 * 推測底片種類。
 *
 * 【影響畫面】底片盒（/crate）每一卷底片罐的片頭顏色與背面小字。由 `RollArtwork` 呼叫。
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
 *   guessFilmType('Kodak', 'Tri X 400')               → 'bw'      （中間是空白也認得）
 *   guessFilmType('Kodak', 'Kodachrome 64')           → 'slide'
 *   guessFilmType('Kodak', 'Panorama Color 200')      → 'color'   （Panorama 不是 Pan）
 *   guessFilmType('Kodak', 'Japan Gold 200')          → 'color'   （Japan 裡的 pan 不算）
 *
 * 【會用到】（都是內建的，不用 import）
 *   - `str.toLowerCase()`、`str.includes(sub)`
 *   - `array.some((x) => ...)`：陣列裡只要有一個符合就回傳 true
 *   - `BW_KEYWORDS`、`SLIDE_KEYWORDS`、`BW_BRANDS`、`toWords`（同一個檔案）
 *
 * 【步驟】
 * 1. 片名整理成字：`const words = toWords(filmName)`，再寫一個 `hasWord(keyword)` 比對 `` ` ${keyword} ` ``。
 * 2. 片名有 `SLIDE_KEYWORDS` 任一個字 → `'slide'`。
 * 3. 片名有 `BW_KEYWORDS` 任一個字 → `'bw'`。
 * 4. 片名含 `color` → `'color'`（黑白品牌出的彩色片，例如 Ilfocolor）。
 * 5. 品牌在 `BW_BRANDS` 裡 → `'bw'`。
 * 6. 都沒有 → `'color'`。
 *
 * 【坑】
 * - 順序很重要：先看片名、後看品牌。片名是「這一款」的資訊，品牌只是「大多數」。
 * - 不要把 `chrome` 當成正片關鍵字：Lomography 的 LomoChrome 系列其實是 C-41 彩色負片，
 *   加了 `chrome` 會把它們全部判成正片。`ektachrome` 夠長，不會誤判。
 * - 關鍵字用「包含」比對的話，短字會誤中別的字：`pan` 會中 Japan、Panorama、Expansion，
 *   `slide` 會中 `expired slides`。所以第 2、3 步比對整個字；只有第 4 步的 `color` 刻意用包含。
 *
 * 【可以想一下】Ilford XP2 是黑白影像，但要用 C-41（彩色負片）的藥水沖洗。
 *   罐子上該印 `BLACK & WHITE` 還是 `C-41`？真實的包裝兩個都印。三種類型不夠表達時，就是該把種類存進資料庫的時候。
 */
export function guessFilmType(brand: string | undefined, filmName: string): FilmType {
  const words = toWords(filmName)
  const hasWord = (keyword: string) => words.includes(` ${keyword} `)
  if (SLIDE_KEYWORDS.some(hasWord)) return 'slide'
  if (BW_KEYWORDS.some(hasWord)) return 'bw'
  // 黑白品牌出的彩色片（例如 Ilfocolor）：片名講得很清楚時，片名優先於品牌。
  // 這裡刻意用「包含」而不是整個字：Ilfocolor、Fujicolor 的 color 黏在字裡
  if (filmName.toLowerCase().includes('color')) return 'color'
  if (brand && BW_BRANDS.includes(brand.trim().toLowerCase())) return 'bw'
  return 'color'
}
