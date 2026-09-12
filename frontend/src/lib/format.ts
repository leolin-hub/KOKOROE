/**
 * 顯示用的格式化工具。純函式，不碰 React，最容易寫單元測試的一層。
 *
 * ── 這個檔案裡藏著整個前端最容易出錯的主題：時區 ──
 *
 * 後端回兩種完全不同的時間型別，必須分開處理：
 *
 *   `loadedAt` / `finishedAt`  → `"2026-03-01"`（LocalDate，**沒有**時區概念）
 *   `createdAt` / `updatedAt`  → `"2026-03-01T09:12:33.512Z"`（Instant，UTC）
 *
 * 「裝片日期」是一個日曆上的日子，不是一個時間點。它不該被時區轉換。
 * 但 `new Date('2026-03-01')` 會被 JS 當成 **UTC 午夜**，
 * 於是在 UTC+8 顯示成 3/1 早上 8 點（還好），在 UTC-5 會顯示成 **2/28**（錯了）。
 * 這就是經典的「日期少一天」bug。
 *
 * 所以：LocalDate 的字串請**當字串處理**，不要丟進 Date。
 */

/**
 * 格式化 LocalDate 字串（`"2026-03-01"`）。
 *
 * TODO(你來寫)：
 * 1. `value` 可能是 undefined（後端 non_null，null 欄位不會出現）→ 回一個佔位字串，
 *    例如 `'—'`。決定好這個佔位符後，整個 app 要一致。
 * 2. 把 `"2026-03-01"` 轉成你想要的顯示形式。
 *    最安全的做法是字串切割：`const [y, m, d] = value.split('-')`，
 *    然後組成 `` `${y}/${m}/${d}` ``。完全不經過 Date，就完全不會有時區問題。
 * 3. 如果你想要「2026年3月1日」這種格式，記得去掉月份的前導零（`Number(m)`）。
 *
 * 進階（想做再做）：若堅持要用 `Intl.DateTimeFormat` 拿到本地化月份名，
 * 請用 `new Date(Number(y), Number(m) - 1, Number(d))`
 * —— 這個建構子是以**本地時區**解讀，不會有偏移。
 */
export function formatDate(value: string | undefined): string {
  throw new Error(`TODO: 實作 formatDate（收到 ${value}）`)
}

/**
 * 格式化 Instant 字串（`"2026-03-01T09:12:33.512Z"`）。
 *
 * TODO(你來寫)：
 * 這個**應該**經過 Date —— 它是真正的時間點，轉成使用者當地時間才是對的行為。
 *
 * 1. `new Date(value)` 解析（ISO 帶 Z 的字串，JS 解析是明確且正確的）。
 * 2. 用 `toLocaleString()` 輸出，或 `Intl.DateTimeFormat` 做更細的控制。
 * 3. 想一下要不要顯示秒。建立時間通常只需要到分鐘。
 */
export function formatInstant(value: string): string {
  throw new Error(`TODO: 實作 formatInstant（收到 ${value}）`)
}

/**
 * 格式化增減感格數，例如 `1` → `"推 +1 格"`、`0` → `"標準"`、`-2` → `"減 -2 格"`。
 *
 * TODO(你來寫)：三個分支就好。
 * 提示：`lib/constants.ts` 的 `PUSH_PULL_OPTIONS` 已經有一份對應表，
 * 你可以直接查表（`PUSH_PULL_OPTIONS.find(o => o.value === stops)?.label`）
 * 而不是再寫一次 if/else —— 少一處要同步維護的文案。
 */
export function formatPushPull(stops: number): string {
  throw new Error(`TODO: 實作 formatPushPull（收到 ${stops}）`)
}

/**
 * 把 `<input type="date">` 需要的值格式化出來。
 *
 * TODO(你來寫)：
 * HTML date input 的 `value` **必須**是 `YYYY-MM-DD`，否則瀏覽器會當成空值
 * （而且不會有任何警告，你只會看到欄位一片空白）。
 *
 * 好消息：後端的 LocalDate 格式剛好就是這個。所以這支函式在多數情況下
 * 只需要處理 undefined → `''` 的轉換。
 *
 * 為什麼還要特別包一支函式而不是直接寫 `roll.loadedAt ?? ''`：
 * 因為 controlled input 的 value 不能是 undefined（React 會把它當成 uncontrolled，
 * 然後在 console 警告你元件從 uncontrolled 變成 controlled）。
 * 把這個「必須是空字串不能是 undefined」的知識收在一個有名字的地方，
 * 比在每個 input 上重複 `?? ''` 更不容易漏。
 */
export function toDateInputValue(value: string | undefined): string {
  throw new Error(`TODO: 實作 toDateInputValue（收到 ${value}）`)
}

/**
 * 取一個卷期的顯示標題，例如 `"Kodak Portra 400"` 或 `"Kodak Portra 400（ISO 400）"`。
 *
 * TODO(你來寫)：自由發揮。這支存在的理由是列表卡片與詳情頁的標題該長得一樣。
 * 注意 `brand` 是 optional —— 想做成 `"Kodak · Portra 400"` 的話要處理它不存在的情況。
 */
export function formatRollTitle(filmName: string, brand?: string): string {
  throw new Error(`TODO: 實作 formatRollTitle（${brand ?? '無品牌'} / ${filmName}）`)
}
