import type { FilmRollListParams } from '../types/filmRoll'

/**
 * Query key 工廠。
 *
 * 為什麼不在每個 hook 裡隨手寫 `['filmRolls', id]`：
 * TanStack Query 的快取失效是靠 key 的**前綴比對**。
 * `invalidateQueries({ queryKey: ['filmRolls'] })` 會失效所有以它開頭的 query。
 * 一旦 key 散落各處，某天有人手滑寫成 `['film-rolls', id]`，
 * 快取不會報錯 —— 它會安靜地變成另一份獨立快取，於是「新增後列表沒更新」。
 * 這類 bug 很難查，因為程式看起來完全正常。
 *
 * 把 key 收在一個地方，就讓這件事變成打錯字會被 TypeScript 抓到的編譯期問題。
 *
 * 階層設計：
 *   ['filmRolls']                          → 全部（失效用）
 *   ['filmRolls', 'list']                  → 所有列表查詢
 *   ['filmRolls', 'list', { status, ... }] → 特定條件的列表
 *   ['filmRolls', 'detail', 1]             → 單筆
 *
 * `as const` 讓 TypeScript 推論出 tuple 而非 string[]，key 的形狀才有型別保護。
 */
export const filmRollKeys = {
  /** 這個資源的所有 query。用於「不管什麼條件，全部重抓」。 */
  all: ['filmRolls'] as const,

  /** 所有列表查詢（不分篩選條件）。新增 / 刪除後該失效這一層。 */
  lists: () => [...filmRollKeys.all, 'list'] as const,

  /**
   * 特定條件的列表查詢。
   *
   * 參數物件直接放進 key —— TanStack Query 會對它做結構化比對
   * （deep equal，且對物件鍵做排序），所以 `{ page: 1, status: 'LOADED' }`
   * 與 `{ status: 'LOADED', page: 1 }` 會命中同一份快取。不需要自己序列化成字串。
   */
  list: (params: FilmRollListParams) => [...filmRollKeys.lists(), params] as const,

  /** 所有單筆查詢。 */
  details: () => [...filmRollKeys.all, 'detail'] as const,

  /** 特定一筆。更新 / 刪除後該失效這一個。 */
  detail: (id: number) => [...filmRollKeys.details(), id] as const,
}
