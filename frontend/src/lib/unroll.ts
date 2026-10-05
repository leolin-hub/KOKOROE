/**
 * 底片盒「攤開」動畫的參數（3c 的 spike 裡由使用者挑定）。
 *
 * 放在 lib 而不是元件檔：底片條（UnrolledFilm）和底片罐的片頭（透過 CrateItem 設的 CSS 變數
 * --unroll-duration）都要用同一個時間，片頭才會剛好在底片捲回罐子時重新出現。
 */

/** 拉出／收回的時間 */
export const UNROLL_MS = 900

/** 拉出來時一次露出幾格 */
export const VISIBLE_FRAMES = 4
