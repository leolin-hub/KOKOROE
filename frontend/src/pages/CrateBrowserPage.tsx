import styles from './CrateBrowserPage.module.css'
import { type ReactNode, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useInfiniteFilmRolls } from '../hooks/useInfiniteFilmRolls'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { parseStatus, parseSort, DEFAULT_SORT } from '../lib/listParams'
import { crateLinkState } from '../lib/backLink'
import { usePhotos } from '../hooks/usePhotos'
import { usePhotoLightbox } from '../hooks/usePhotoLightbox'
import CrateItem from '../components/CrateItem'
import PhotoLightbox from '../components/PhotoLightbox'
import FilmRollFilters from '../components/FilmRollFilters'
import ErrorBanner from '../components/ErrorBanner'
import type { FilmRollStatus } from '../types/filmRoll'

/**
 * 卷期頁的「底片盒」檢視。網址 `/film-rolls?view=crate`（舊的 `/crate` 會導過來）。
 * 標題、檢視切換與新增按鈕在外層的 `FilmRollsPage`；這支從計數列開始。
 *
 * 【影響畫面】卷期頁切到「底片盒」時看到的內容（以下是當初寫成獨立頁面時的說明，標題已移到外層）：
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
 *      （3c 起 Enter 改成拉出焦點卷期的底片條，詳情頁從底片條下方的連結進去；Esc 收回）
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
  const [searchParams, setSearchParams] = useSearchParams()
  const status = parseStatus(searchParams.get('status'))
  const sort = parseSort(searchParams.get('sort'))
  const { data, isPending, isError, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteFilmRolls({ status, sort })
  const rolls = data ? data.pages.flatMap((p) => p.content) : []
  // 點進詳情頁時帶著目前的篩選條件，詳情頁的「← 回到唱片櫃」才能回到同一個篩選
  const linkState = crateLinkState(searchParams.toString())

  const [focusedIndex, setFocusedIndex] = useState(0)
  const viewportRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLOListElement>(null)

  // ── 攤開（3c）──
  // 哪一卷的底片條拉出來了、底片條上點開了哪一張。都是暫時的狀態，不放網址：
  // 重新整理後回到底片盒原本的樣子才自然
  const [unrolledId, setUnrolledId] = useState<number | null>(null)
  const [lightboxPhotoId, setLightboxPhotoId] = useState<number | null>(null)
  // 焦點卷期的底片條元件一掛上就會抓照片清單（還沒拉出來就先抓，拉出來時才不用等），
  // 這裡讀的是同一份快取，不會再打一次 API
  const { data: unrolledPhotos } = usePhotos(unrolledId ?? 0)
  const lightbox = usePhotoLightbox({
    rollId: unrolledId ?? 0,
    photos: unrolledPhotos ?? [],
    openId: lightboxPhotoId,
    onOpenChange: setLightboxPhotoId,
  })

  /**
   * 收回底片條的唯一出口（Esc、換到別卷都走這裡）。
   * 焦點原本可能在底片條或它的格子上，收起來（甚至整個元件卸載）之後焦點會掉到 <body>，
   * 鍵盤就沒反應了；所以一律還給底片盒，↑ ↓ 才能繼續用。
   */
  function closeUnroll() {
    setUnrolledId(null)
    setLightboxPhotoId(null)
    viewportRef.current?.focus({ preventScroll: true })
  }

  function handleScroll() {
    const viewport = viewportRef.current
    const slotHeight = listRef.current?.firstElementChild?.clientHeight
    if (!viewport || !slotHeight) return
    const index = Math.min(Math.round(viewport.scrollTop / slotHeight), rolls.length - 1)
    // 換到別卷時，原本拉出來的底片條收回去：一次只攤開焦點那一卷
    if (index !== focusedIndex && unrolledId !== null) closeUnroll()
    setFocusedIndex(index)
  }

  const reducedMotion = usePrefersReducedMotion()

  function scrollToIndex(index: number) {
    const slotHeight = listRef.current?.firstElementChild?.clientHeight ?? 0
    viewportRef.current?.scrollTo({ top: index * slotHeight, behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // 焦點在櫃子裡的按鈕或連結上（罐子、底片條的格子、資訊欄的連結）時，Enter 交給它們自己處理
    if (e.target !== e.currentTarget && (e.key === 'Enter' || e.key === ' ')) return
    if (e.key === 'ArrowDown') {
      scrollToIndex(Math.min(focusedIndex + 1, rolls.length - 1))
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      scrollToIndex(Math.max(focusedIndex - 1, 0))
      e.preventDefault()
    } else if (e.key === 'Home') {
      scrollToIndex(0)
      e.preventDefault()
    } else if (e.key === 'End') {
      scrollToIndex(rolls.length - 1)
      e.preventDefault()
    } else if (e.key === 'Enter') {
      // Enter 拉出／收回焦點卷期的底片條（詳情頁改從底片條下方的連結進去）
      const roll = rolls[focusedIndex]
      if (roll) setUnrolledId((current) => (current === roll.id ? null : roll.id))
      e.preventDefault()
    } else if (e.key === 'Escape' && unrolledId !== null) {
      closeUnroll()
      e.preventDefault()
    }
  }

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && focusedIndex >= rolls.length - 3) {
      void fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, focusedIndex, rolls.length, fetchNextPage])

  function updateSearchParams(update: (next: URLSearchParams) => void) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      update(next)
      return next
    })
  }

  function resetFocus() {
    setFocusedIndex(0)
    setUnrolledId(null)
    viewportRef.current?.scrollTo({ top: 0 })
  }

  function handleStatusChange(nextStatus: FilmRollStatus | undefined) {
    updateSearchParams((next) => {
      if (nextStatus) next.set('status', nextStatus)
      else next.delete('status')
    })
    resetFocus()
  }

  function handleSortChange(nextSort: string) {
    updateSearchParams((next) => {
      if (nextSort === DEFAULT_SORT) next.delete('sort')
      else next.set('sort', nextSort)
    })
    resetFocus()
  }

  let content: ReactNode
  if (isPending) {
    content = <p className={styles.message}>載入中…</p>
  } else if (isError) {
    content = <ErrorBanner error={error} onRetry={() => void refetch()} />
  } else if (rolls.length > 0) {
    content = (
      <>
        {/* 外框只負責畫鍵盤焦點：櫃子本身的上下淡出（mask）會把畫在櫃子上的焦點框一起裁掉 */}
        <div className={styles.frame}>
          <div
            ref={viewportRef}
            className={styles.viewport}
            // 底片條用它找出底片盒的右緣，決定最多能拉出多長
            data-crate-viewport=""
            tabIndex={0}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            aria-label="底片盒，用上下方向鍵切換卷期，Enter 拉出底片"
          >
            <ol ref={listRef} className={styles.list}>
              {rolls.map((roll, index) => (
                <CrateItem
                  key={roll.id}
                  roll={roll}
                  offset={index - focusedIndex}
                  linkState={linkState}
                  unrolled={unrolledId === roll.id}
                  onSelect={() => scrollToIndex(index)}
                  onToggleUnroll={() => setUnrolledId((current) => (current === roll.id ? null : roll.id))}
                  onOpenPhoto={lightbox.open}
                  onCloseUnroll={closeUnroll}
                />
              ))}
            </ol>
            {isFetchingNextPage && <p className={styles.loadingMore}>載入更多…</p>}
          </div>
        </div>
        <p className={styles.hint}>↑ ↓ 切換 · Enter 拉出底片 · ← → 拉動 · Esc 收回</p>
        <PhotoLightbox {...lightbox.props} />
      </>
    )
  } else {
    content = (
      <div className={styles.message}>
        {status ? (
          <p>沒有符合的卷期。</p>
        ) : (
          <>
            <p>底片盒是空的。</p>
            <Link to="/film-rolls/new" className={styles.link}>
              來裝第一卷吧
            </Link>
          </>
        )}
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.toolbar}>
        <FilmRollFilters status={status} sort={sort} onStatusChange={handleStatusChange} onSortChange={handleSortChange} />
        {data && data.pages[0].totalElements > 0 && (
          <p className={styles.counter}>
            第 {focusedIndex + 1} / {data.pages[0].totalElements} 卷
          </p>
        )}
      </header>
      {content}
    </div>
  )
}
