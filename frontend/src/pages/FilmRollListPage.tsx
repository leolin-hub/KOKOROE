import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useFilmRolls } from '../hooks/useFilmRolls'
import FilmRollCard from '../components/FilmRollCard'
import FilmRollFilters from '../components/FilmRollFilters'
import Pagination from '../components/Pagination'
import ErrorBanner from '../components/ErrorBanner'
import { DEFAULT_PAGE_SIZE, STATUS_LABELS } from '../lib/constants'
import { DEFAULT_SORT, parseSort, parseStatus } from '../lib/listParams'
import type { FilmRollListParams, FilmRollStatus } from '../types/filmRoll'
import styles from './FilmRollListPage.module.css'

/*
 * URL 是使用者可以亂打的外部輸入，讀進來一律先驗證，不合法就退回預設值。
 * status 與 sort 的解析和唱片櫃瀏覽頁共用，在 lib/listParams.ts；頁碼只有這一頁用得到，留在這裡。
 */

/** `Number(null)` 是 0（剛好對），但 `Number('abc')` 是 NaN，負數與小數也要擋。 */
function parsePage(raw: string | null): number {
  const page = Number(raw)
  return Number.isInteger(page) && page >= 0 ? page : 0
}

/**
 * 卷期頁的「清單」檢視（`/film-rolls`）。標題列與檢視切換在外層的 `FilmRollsPage`。
 *
 * 篩選、排序、分頁狀態都放在 URL（`useSearchParams`），不放 useState：
 * 網址可以分享、加書籤，重新整理與瀏覽器上一頁都會如預期運作。
 * 參數等於預設值時直接從 URL 刪掉，網址保持乾淨。
 */
export default function FilmRollListPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const status = parseStatus(searchParams.get('status'))
  const page = parsePage(searchParams.get('page'))
  const sort = parseSort(searchParams.get('sort'))

  const params: FilmRollListParams = { status, page, size: DEFAULT_PAGE_SIZE, sort }
  const { data, isPending, isError, error, isPlaceholderData, refetch } = useFilmRolls(params)

  /** 複製一份目前的 query string 改完再寫回，不直接改動 React Router 給的物件。 */
  function updateSearchParams(update: (next: URLSearchParams) => void) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      update(next)
      return next
    })
  }

  // 改篩選或排序時必須把 page 歸零：從第 5 頁切到只有 2 頁的條件，會看到一片空白。
  function handleStatusChange(nextStatus: FilmRollStatus | undefined) {
    updateSearchParams((next) => {
      if (nextStatus) next.set('status', nextStatus)
      else next.delete('status')
      next.delete('page')
    })
  }

  function handleSortChange(nextSort: string) {
    updateSearchParams((next) => {
      if (nextSort === DEFAULT_SORT) next.delete('sort')
      else next.set('sort', nextSort)
      next.delete('page')
    })
  }

  function handlePageChange(nextPage: number) {
    updateSearchParams((next) => {
      if (nextPage === 0) next.delete('page')
      else next.set('page', String(nextPage))
    })
  }

  // 用 isPending 而非 isLoading：它才能讓 TypeScript 在後面的分支確定 data 有值。
  let content: ReactNode
  if (isPending) {
    content = <p className={styles.loading}>載入中…</p>
  } else if (isError) {
    // 包一層箭頭函式：直接傳 refetch 的話，按鈕的 click event 會被當成 refetch 的選項參數。
    content = <ErrorBanner error={error} onRetry={() => void refetch()} />
  } else if (data.content.length > 0) {
    content = (
      <>
        <div className={`${styles.list} ${isPlaceholderData ? styles.stale : ''}`}>
          {data.content.map((roll) => (
            <FilmRollCard key={roll.id} roll={roll} />
          ))}
        </div>
        <Pagination page={data} onPageChange={handlePageChange} isLoading={isPlaceholderData} />
      </>
    )
  } else if (data.totalElements > 0) {
    // 有資料但這一頁是空的：網址上的 page 超出範圍，例如手動改成 ?page=99。
    content = (
      <div className={styles.empty}>
        <p>這一頁沒有資料。</p>
        <button type="button" onClick={() => handlePageChange(0)}>
          回到第一頁
        </button>
      </div>
    )
  } else if (status) {
    content = <p className={styles.empty}>沒有「{STATUS_LABELS[status]}」的卷期。</p>
  } else {
    // 空狀態不是錯誤：不顯示錯誤訊息，也不留一片空白，告訴使用者下一步能做什麼。
    content = (
      <div className={styles.empty}>
        <p>還沒有任何卷期。</p>
        <Link to="/film-rolls/new">來裝第一卷吧</Link>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* 標題與「裝新的一卷」在外層的 FilmRollsPage，和底片盒檢視共用 */}
      <FilmRollFilters
        status={status}
        sort={sort}
        onStatusChange={handleStatusChange}
        onSortChange={handleSortChange}
      />

      {content}
    </div>
  )
}
