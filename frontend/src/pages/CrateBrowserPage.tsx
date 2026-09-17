import styles from './CrateBrowserPage.module.css'

/**
 * 唱片櫃瀏覽頁。路由 `/crate`。
 *
 * 【影響畫面】上方導覽列「唱片櫃」點進來的頁面：
 *   標題「唱片櫃」＋「第 3 / 15 卷」
 *   篩選列（和列表頁同一個 FilmRollFilters，狀態與排序）
 *   一個固定高度的櫃子，垂直捲動、每次停在某一卷的正中央；焦點卷期放大，其他往後傾
 *   櫃子下方的操作提示：「↑ ↓ 切換 · Enter 查看詳情」
 *
 * 這是這一步最大的一支，建議最後寫，前面的元件與 hook 都先完成並各自確認過。
 *
 * 【會用到】
 *   - `useEffect`、`useRef`、`useState`、`KeyboardEvent`（type）   'react'                          ← 要自己 import
 *   - `useNavigate`、`useSearchParams`                              'react-router'                   ← 要自己 import
 *   - `useInfiniteFilmRolls(params)`                                 '../hooks/useInfiniteFilmRolls'  ← 要自己 import
 *   - `usePrefersReducedMotion()`                                    '../hooks/usePrefersReducedMotion'
 *   - `parseStatus`、`parseSort`、`DEFAULT_SORT`                      '../lib/listParams'
 *   - `DEFAULT_PAGE_SIZE`（可選）                                     '../lib/constants'
 *   - `CrateItem`、`FilmRollFilters`、`ErrorBanner`                   '../components/...'
 *   - `FilmRollStatus`（type）                                        '../types/filmRoll'
 *   - styles：page、toolbar、title、counter、viewport、list、loadingMore、message、hint（已 import）
 *
 * 【步驟】
 *
 * ── A. 資料 ──
 * 1. 讀 URL：`const [searchParams, setSearchParams] = useSearchParams()`，
 *    `status = parseStatus(searchParams.get('status'))`、`sort = parseSort(searchParams.get('sort'))`。
 *    （和 FilmRollListPage 完全一樣，可以打開那支對照；唱片櫃沒有 page 參數。）
 * 2. `const { data, isPending, isError, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteFilmRolls({ status, sort })`
 * 3. 把所有頁接成一個陣列：`const rolls = data ? data.pages.flatMap((p) => p.content) : []`
 *    總卷數：`data?.pages[0]?.totalElements ?? 0`
 *
 * ── B. 焦點 ──
 * 4. `const [focusedIndex, setFocusedIndex] = useState(0)`
 *    `const viewportRef = useRef<HTMLDivElement>(null)`（櫃子，要讀 scrollTop）
 *    `const listRef = useRef<HTMLOListElement>(null)`（清單，要讀一格的高度）
 * 5. 捲動時算出目前第幾格：
 *    ```ts
 *    function handleScroll() {
 *      const viewport = viewportRef.current
 *      const slotHeight = listRef.current?.firstElementChild?.clientHeight
 *      if (!viewport || !slotHeight) return
 *      const index = Math.round(viewport.scrollTop / slotHeight)
 *      setFocusedIndex(Math.min(index, rolls.length - 1))
 *    }
 *    ```
 *    為什麼除法就能算：CSS 讓每格高度固定，清單上下的留白又剛好讓 scrollTop = 0 時第 0 格置中，
 *    所以 scrollTop 每增加一格的高度，置中的就往下一格。
 *    同一個值重複 setState 不會觸發 re-render，所以捲動中每一幀都呼叫也沒關係。
 *
 * ── C. 鍵盤 ──
 * 6. `const reducedMotion = usePrefersReducedMotion()`
 * 7. 捲到第 i 格：
 *    ```ts
 *    function scrollToIndex(index: number) {
 *      const slotHeight = listRef.current?.firstElementChild?.clientHeight ?? 0
 *      viewportRef.current?.scrollTo({ top: index * slotHeight, behavior: reducedMotion ? 'auto' : 'smooth' })
 *    }
 *    ```
 *    不需要在這裡 setFocusedIndex：捲動會觸發 handleScroll，焦點自然跟上，真相只有「捲到哪裡」一份。
 * 8. `handleKeyDown(e: KeyboardEvent<HTMLDivElement>)`：
 *    - `ArrowDown` → `scrollToIndex(Math.min(focusedIndex + 1, rolls.length - 1))`
 *    - `ArrowUp`   → `scrollToIndex(Math.max(focusedIndex - 1, 0))`
 *    - `Home` / `End` → 第一卷 / 最後一卷（已載入的最後一卷）
 *    - `Enter` → `navigate(`/film-rolls/${rolls[focusedIndex].id}`)`
 *    - 處理了的按鍵要 `e.preventDefault()`，其他按鍵不要擋（不然 Tab 會失效）。
 *
 * ── D. 自動載入下一批 ──
 * 9. ```ts
 *    useEffect(() => {
 *      if (hasNextPage && !isFetchingNextPage && focusedIndex >= rolls.length - 3) {
 *        void fetchNextPage()
 *      }
 *    }, [focusedIndex, rolls.length, hasNextPage, isFetchingNextPage, fetchNextPage])
 *    ```
 *    焦點走到倒數第 3 卷就先抓，使用者捲到底時下一批通常已經到了。
 *
 * ── E. 換篩選條件 ──
 * 10. 照列表頁寫 `handleStatusChange`、`handleSortChange`（參數等於預設值時從 URL 刪掉），
 *     但**額外**要把焦點與捲動位置歸零：`setFocusedIndex(0)` 和 `viewportRef.current?.scrollTo({ top: 0 })`。
 *     不歸零的話：原本停在第 12 卷，換成只有 3 卷的條件，focusedIndex 還是 12，計數會顯示「第 13 / 3 卷」。
 *
 * ── F. 畫面 ──
 * 11. 一律先 render 工具列（標題、計數、FilmRollFilters），下面依狀態擇一：
 *     - `isPending` → `<p className={styles.message}>載入中…</p>`
 *     - `isError` → `<ErrorBanner error={error} onRetry={() => void refetch()} />`
 *     - `rolls.length === 0` → 空狀態（有篩選時說「沒有符合的卷期」，沒篩選時引導去新增）
 *     - 否則是櫃子：
 *       ```tsx
 *       <div
 *         ref={viewportRef}
 *         className={styles.viewport}
 *         tabIndex={0}
 *         onScroll={handleScroll}
 *         onKeyDown={handleKeyDown}
 *         aria-label="卷期唱片櫃，用上下方向鍵切換"
 *       >
 *         <ol ref={listRef} className={styles.list}>
 *           {rolls.map((roll, index) => (
 *             <CrateItem key={roll.id} roll={roll} offset={index - focusedIndex} />
 *           ))}
 *         </ol>
 *         {isFetchingNextPage && <p className={styles.loadingMore}>載入更多…</p>}
 *       </div>
 *       <p className={styles.hint}>↑ ↓ 切換 · Enter 查看詳情</p>
 *       ```
 * 12. 刪掉最下面的 `.placeholder` 區塊（連同 CSS 裡的 `.placeholder`）。
 *
 * 【坑】
 * - 計數在資料還沒到時會算成「第 1 / 0 卷」：只在有資料時顯示。
 * - `tabIndex={0}` 讓櫃子本身能拿到鍵盤焦點；不加的話 onKeyDown 永遠收不到事件。
 *   第一次要先點一下櫃子或按 Tab 進去，方向鍵才有作用。
 * - `rolls[focusedIndex]` 在 `rolls` 為空時是 undefined，Enter 前要先檢查。
 *
 * 【可以想一下】後端用的是頁碼分頁。捲到第 2 頁之前，如果有人新增了一卷，
 *   原本第 1 頁的最後一卷會被擠到第 2 頁，同一卷就出現兩次，React 會警告 key 重複。
 *   個人使用幾乎不會遇到；要處理的話，可以在接陣列時用 id 去重：
 *   `[...new Map(rolls.map((r) => [r.id, r])).values()]`
 */
export default function CrateBrowserPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>唱片櫃</h1>
      <p className={styles.placeholder}>TODO(你來寫)：CrateBrowserPage，實作順序見 frontend/README.md 第 5 階段</p>
    </div>
  )
}
