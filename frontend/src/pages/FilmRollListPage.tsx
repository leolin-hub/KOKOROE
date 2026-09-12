import { Link, useSearchParams } from 'react-router'
import { useFilmRolls } from '../hooks/useFilmRolls'
import FilmRollCard from '../components/FilmRollCard'
import FilmRollFilters from '../components/FilmRollFilters'
import Pagination from '../components/Pagination'
import ErrorBanner from '../components/ErrorBanner'
import { DEFAULT_PAGE_SIZE, STATUS_ORDER } from '../lib/constants'
import type { FilmRollListParams, FilmRollStatus } from '../types/filmRoll'
import styles from './FilmRollListPage.module.css'

/**
 * 卷期列表頁。
 *
 * 上面的 import 都是你會用到的東西，已經接好了。
 * 目前它們還沒被使用 —— 實作過程中會一個個派上用場。
 *
 * ── 這一頁的核心設計決定：篩選與分頁狀態放在 URL ──
 *
 * `useSearchParams` 用起來像 useState，但真相存在 URL 的 query string。
 * 好處是網址可以分享、可以加書籤、瀏覽器上一頁會如預期運作、重新整理後狀態還在。
 * 凡是使用者會期待「重新整理後還在」的狀態，都屬於 URL 而不是 useState。
 *
 * ══════════════════════════════════════════════════
 * TODO(你來寫)：建議的實作順序
 * ══════════════════════════════════════════════════
 *
 * ### 步驟 1：從 URL 讀出查詢條件
 *
 * ```ts
 * const [searchParams, setSearchParams] = useSearchParams()
 *
 * const rawStatus = searchParams.get('status')
 * const status = STATUS_ORDER.includes(rawStatus as FilmRollStatus)
 *   ? (rawStatus as FilmRollStatus)
 *   : undefined
 *
 * const params: FilmRollListParams = {
 *   status,
 *   page: ...,
 *   size: DEFAULT_PAGE_SIZE,
 *   sort: searchParams.get('sort') ?? 'loadedAt,desc',
 * }
 * ```
 *
 * ⚠️ 為什麼要驗證 status 而不是直接 `as FilmRollStatus`：
 *    URL 是使用者可以亂打的。`?status=BANANA` 會讓型別斷言變成一個假承諾，
 *    TypeScript 不會擋，然後你送出去拿到 400。
 *    URL 跟表單輸入一樣屬於外部輸入 —— 不可信。
 *
 * ⚠️ 分頁數字的陷阱：`Number(null)` 是 **0**（剛好對），
 *    但 `Number('abc')` 是 **NaN**，`?page=abc` 會讓你發出 `?page=NaN`。
 *    也要擋負數。
 *
 * ### 步驟 2：呼叫 hook
 *
 * ```ts
 * const { data, isLoading, isError, error, isPlaceholderData } = useFilmRolls(params)
 * ```
 *
 * ### 步驟 3：處理四種狀態，順序很重要
 *
 * 1. `isLoading` → 載入中
 * 2. `isError` → `<ErrorBanner error={error} />`
 * 3. `data.content.length === 0` → **空狀態**
 * 4. 有資料 → `data.content.map(roll => <FilmRollCard key={roll.id} roll={roll} />)`
 *
 * 第 3 點最容易被忘記，但第一次打開 app 看到的就是它。
 * 「載入完成但沒資料」不是錯誤：不該顯示錯誤訊息，
 * 也不該顯示一片空白讓人以為壞了。寫一句「還沒有任何卷期，來裝第一卷吧」。
 *
 * ### 步驟 4：接上篩選與分頁的 onChange
 *
 * ```ts
 * function handleStatusChange(next: FilmRollStatus | undefined) {
 *   setSearchParams((prev) => {
 *     if (next) prev.set('status', next)
 *     else prev.delete('status')   // 「不篩選」是刪掉參數，不是設成空字串
 *     prev.delete('page')          // ← 這行很重要，見下方
 *     return prev
 *   })
 * }
 * ```
 *
 * ⚠️ 改篩選條件時**必須**把 page 歸零。
 *    否則從第 5 頁切換到一個只有 2 頁的條件，你會看到一片空白，
 *    而且完全沒有錯誤訊息可循。這個 bug 在真實專案裡極常見。
 *
 * ### 步驟 5（做完上面再回來）：翻頁時的閃動
 *
 * 如果你在 `useFilmRolls` 加了 `placeholderData: keepPreviousData`，
 * 就可以用 `isPlaceholderData` 把列表調淡、暫時停用翻頁鈕，
 * 讓「正在載入新一頁」這件事看得出來。
 */
export default function FilmRollListPage() {
  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>我的卷期</h1>
        <Link to="/film-rolls/new" className={styles.newButton}>
          裝新的一卷
        </Link>
      </div>

      <div className={styles.placeholder}>
        <p>
          <strong>FilmRollListPage</strong> 還沒實作。
        </p>
        <p>
          先完成 <code>api/http.ts</code> → <code>api/filmRolls.ts</code> →{' '}
          <code>hooks/useFilmRolls.ts</code>，再回來接這一頁。
        </p>
      </div>
    </div>
  )
}
