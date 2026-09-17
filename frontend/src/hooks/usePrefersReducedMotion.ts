/**
 * 使用者是否在作業系統開了「減少動態效果」。
 *
 * 【影響畫面】唱片櫃用方向鍵切換卷期時：
 *   沒開 → 平滑捲動到下一卷
 *   有開 → 直接跳過去，不做捲動動畫
 * （傾斜、縮放的過場動畫由 CSS 的 `@media (prefers-reduced-motion: reduce)` 處理，已經寫好了；
 *   但 `scrollTo({ behavior: 'smooth' })` 是 JavaScript 發起的，CSS 管不到，所以需要這支 hook。）
 *
 * 在哪裡開：Windows「設定 → 協助工具 → 視覺效果 → 動畫效果」關掉；
 * 或 Chrome DevTools → ⋮ → More tools → Rendering → Emulate CSS media feature prefers-reduced-motion。
 *
 * 【會用到】
 *   - `useSyncExternalStore`                              'react'  ← 要自己 import
 *   - `window.matchMedia('(prefers-reduced-motion: reduce)')`       瀏覽器內建
 *   - `mediaQueryList.matches`、`addEventListener('change', ...)`、`removeEventListener`
 *
 * 【步驟】
 * 0. 刪掉 `return false` 佔位。
 * 1. 在 module 層（函式外面）定義查詢字串：`const QUERY = '(prefers-reduced-motion: reduce)'`
 * 2. 在 module 層定義 subscribe：
 *    ```ts
 *    function subscribe(onChange: () => void) {
 *      const mql = window.matchMedia(QUERY)
 *      mql.addEventListener('change', onChange)
 *      return () => mql.removeEventListener('change', onChange)
 *    }
 *    ```
 * 3. 在 module 層定義 getSnapshot：`() => window.matchMedia(QUERY).matches`
 * 4. hook 本體：`return useSyncExternalStore(subscribe, getSnapshot, () => false)`
 *    第三個參數是 server 端的值（SSR 時沒有 window）；我們驗證元件時會在 Node 裡 render，所以要給。
 *
 * 【為什麼不用 useState + useEffect】
 *   常見寫法是 useEffect 裡 addEventListener 再 setState。它會先用初始值 render 一次、
 *   effect 跑完才更新，中間有一次畫面用的是錯的值。
 *   `useSyncExternalStore` 是 React 專門給「訂閱外部來源」用的 API，沒有這個落差，也不必自己管清除。
 *
 * 【坑】subscribe 和 getSnapshot 一定要定義在元件外面（或用 useCallback 固定）。
 *   寫在 hook 裡的話每次 render 都是新函式，React 會每次重新訂閱。
 */
export function usePrefersReducedMotion(): boolean {
  return false
}
