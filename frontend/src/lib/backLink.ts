/**
 * 詳情頁、編輯頁左上角的「← 回到…」要回哪裡。
 *
 * 卷期可以從兩個地方點進來：卷期列表（/film-rolls）與唱片櫃（/crate）。
 * 從唱片櫃進來時，連結用 react-router 的 `state` 帶一個標記，詳情頁讀到就回唱片櫃，讀不到就回列表。
 *
 * 為什麼用 `state` 而不是 `navigate(-1)`：
 *   1. 直接貼網址打開詳情頁時沒有上一頁，`navigate(-1)` 會離開這個網站。
 *   2. 詳情 → 編輯 → 儲存 → 詳情之後，上一頁是編輯頁，不是唱片櫃。
 * 代價是每個「從唱片櫃進來之後還會再往下走」的連結（編輯、儲存後跳回詳情）都要記得把 state 傳下去。
 *
 * `state` 存在瀏覽紀錄裡，重新整理後還在；但它的型別是 `unknown`，所以讀的時候要檢查形狀。
 * 只存篩選條件（query string），路徑固定是 `/crate`，不存任意網址。
 */

export interface BackLink {
  to: string
  label: string
}

interface CrateLinkState {
  from: 'crate'
  /** 唱片櫃當時的篩選條件，不含 `?`，例如 `status=LOADED&sort=iso,asc` */
  search: string
}

const LIST_BACK_LINK: BackLink = { to: '/film-rolls', label: '回到列表' }

/** 唱片櫃點進詳情頁時，放在連結 `state` 裡的值。 */
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

/** 由 `useLocation().state` 決定返回連結；不是從唱片櫃來的一律回列表。 */
export function readBackLink(state: unknown): BackLink {
  if (!isCrateLinkState(state)) return LIST_BACK_LINK
  return { to: state.search ? `/crate?${state.search}` : '/crate', label: '回到唱片櫃' }
}
