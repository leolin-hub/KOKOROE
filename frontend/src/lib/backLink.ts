/**
 * 詳情頁、編輯頁左上角的「← 回到…」要回哪裡。
 *
 * 卷期可以從卷期頁的兩種檢視點進來：清單（/film-rolls）與底片盒（/film-rolls?view=crate）。
 * 從底片盒進來時，連結用 react-router 的 `state` 帶一個標記，詳情頁讀到就回底片盒，讀不到就回清單。
 *
 * 為什麼用 `state` 而不是 `navigate(-1)`：
 *   1. 直接貼網址打開詳情頁時沒有上一頁，`navigate(-1)` 會離開這個網站。
 *   2. 詳情 → 編輯 → 儲存 → 詳情之後，上一頁是編輯頁，不是唱片櫃。
 * 代價是每個「從唱片櫃進來之後還會再往下走」的連結（編輯、儲存後跳回詳情）都要記得把 state 傳下去。
 *
 * `state` 存在瀏覽紀錄裡，重新整理後還在；但它的型別是 `unknown`，所以讀的時候要檢查形狀。
 * 只存篩選條件（query string），路徑固定是 `/film-rolls`，不存任意網址。
 */

export interface BackLink {
  to: string
  label: string
}

interface CrateLinkState {
  from: 'crate'
  /** 底片盒當時的網址參數，不含 `?`，例如 `view=crate&status=LOADED&sort=iso,asc` */
  search: string
}

const LIST_BACK_LINK: BackLink = { to: '/film-rolls', label: '回到列表' }

/** 底片盒點進詳情頁時，放在連結 `state` 裡的值。 */
export function crateLinkState(search: string): CrateLinkState {
  return { from: 'crate', search }
}

function isCrateLinkState(state: unknown): state is CrateLinkState {
  return (
    typeof state === 'object' &&
    state !== null &&
    'from' in state &&
    state.from === 'crate' &&
    'search' in state &&
    typeof state.search === 'string'
  )
}

/**
 * 由 `useLocation().state` 決定返回連結；不是從底片盒來的一律回清單。
 * 底片盒現在是卷期頁的一種檢視（`/film-rolls?view=crate`）：帶回當時的篩選，並確保 view 是 crate。
 */
export function readBackLink(state: unknown): BackLink {
  if (!isCrateLinkState(state)) return LIST_BACK_LINK
  const params = new URLSearchParams(state.search)
  params.set('view', 'crate')
  return { to: `/film-rolls?${params}`, label: '回到底片盒' }
}
