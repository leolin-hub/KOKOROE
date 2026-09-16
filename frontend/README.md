# Kokoroe Frontend

底片攝影與器材履歷管理系統的前端。

- **React 19** / **TypeScript** / **Vite 8** / **TanStack Query 5** / **React Router 8**
- 樣式：CSS Modules + CSS 變數（`src/index.css` 是設計 token 的唯一來源）
- 表單：原生受控元件，無表單套件

> **這是一份刻意留白的骨架。**
> 所有檔案、import、型別與 props 契約都已就位，
> 但**函式主體留給你實作** —— 每一支都有 `TODO(你來寫)` 與實作提示。
> 型別檢查與 build 目前都是綠的，你可以隨時 `npm run build` 確認沒有寫壞。

---

## 快速啟動

```bash
# 1. 先起後端（含資料庫）
cd ..
docker compose up -d
cd backend && ./mvnw spring-boot:run    # Windows: .\mvnw.cmd spring-boot:run

# 2. 另開一個終端機起前端
cd frontend
cp .env.example .env      # 首次執行才需要
npm install               # 首次執行才需要
npm run dev
```

前端啟動於 `http://localhost:5173`，
`/api/**` 的請求由 Vite dev proxy 轉給 `http://localhost:8080`（見 `vite.config.ts`）。

因為走 proxy，瀏覽器眼中前後端同源，**後端完全不需要設定 CORS**。

| 指令 | 作用 |
|---|---|
| `npm run dev` | 開發伺服器（HMR，不做型別檢查） |
| `npm run build` | 型別檢查 + 打包（`tsc -b && vite build`） |
| `npm run lint` | oxlint |
| `npm run preview` | 預覽 build 後的結果 |

> `npm run dev` **不會**檢查型別 —— Vite 只做轉譯。
> 寫一段時間後記得跑一次 `npm run build`，不然型別錯誤會累積到很難處理。

### 關於 lint 的一堆 warning

現在跑 `npm run lint` 會看到約 40 個
`Identifier 'xxx' is imported but never used` 的警告（**0 個 error**）。

這是預期的，而且可以當成進度表用：每個警告都代表
「這個檔案已經幫你 import 好了某個工具，但你還沒用到它」。
實作完一支函式，對應的警告就會消失 —— **警告歸零時，骨架就填完了。**

所以在這個階段不要為了消警告而刪 import，那會刪掉給你的線索。

---

## 目錄結構

```
src/
├─ types/filmRoll.ts        後端契約的 TS 鏡像（唯一真相來源）
├─ api/
│  ├─ problem.ts            RFC 9457 錯誤格式 + ApiError
│  ├─ http.ts               fetch 封裝（整個專案只有這裡碰 fetch）
│  └─ filmRolls.ts          五支 endpoint 函式
├─ hooks/
│  ├─ queryKeys.ts          query key 工廠
│  ├─ useFilmRolls.ts       列表查詢
│  ├─ useFilmRoll.ts        單筆查詢
│  └─ useFilmRollMutations.ts  新增／更新／刪除
├─ lib/
│  ├─ constants.ts          狀態文案、選項表
│  └─ format.ts             顯示格式化（日期時區的坑都在這）
├─ components/              可重用元件，各自帶一支 .module.css
└─ pages/                   路由對應的頁面
```

分層原則：**下層不知道上層存在。**

`api/` 不含任何 React，`hooks/` 不含任何 JSX，`components/` 不直接呼叫 `fetch`。
這個方向性讓每一層都能單獨被理解與測試。

---

## 建議的實作順序

由下往上做。每一步都建立在前一步之上，**不要跳著做** ——
跳著做的話你會在沒有可運作的資料流時去調 UI，很難判斷問題出在哪一層。

### 第 1 階段：讓資料流得通

| # | 檔案 | 重點 |
|---|---|---|
| 1 | `api/problem.ts` | `toFieldErrors` / `toUserMessage` |
| 2 | `api/http.ts` | **最重要的一支。** 204 無 body、錯誤回應不一定是 JSON |
| 3 | `api/filmRolls.ts` | 五支各一行 |
| 4 | `main.tsx` | QueryClient 的 `defaultOptions`（4xx 不重試） |
| 5 | `hooks/useFilmRolls.ts` | `staleTime`、`keepPreviousData` |

做完第 3 步就可以在瀏覽器 console 驗證：

```js
// 在 dev server 開著的頁面上，開 console 貼這段
const r = await fetch('/api/v1/film-rolls')
console.log(r.status, await r.json())
```

拿到 `{ content: [], page: 0, ... }` 就表示 proxy 與後端都通了。
**先確認這件事再往下做** —— 否則後面每個問題你都要懷疑是不是連線問題。

### 第 2 階段：列表頁能看到東西

| # | 檔案 | 重點 |
|---|---|---|
| 6 | `lib/format.ts` | LocalDate 不要經過 `Date`（會少一天） |
| 7 | `components/StatusBadge.tsx` | 暖身用；順便想想 `Record<>` 的窮舉檢查 |
| 8 | `components/ErrorBanner.tsx` | 別顯示 `error.message` 給使用者 |
| 9 | `components/FilmRollCard.tsx` | optional 欄位怎麼呈現 |
| 10 | `pages/FilmRollListPage.tsx` | **四種狀態**：loading／error／空／有資料 |

此時資料庫是空的，所以你看到的會是**空狀態**。
這正好是驗證第 10 步有沒有做對的機會 —— 空狀態不是錯誤，
不該顯示錯誤訊息，也不該是一片空白。

想塞測試資料的話：

```bash
# 先建一台相機，回應裡的 id 就是下面的 cameraId
curl -X POST http://localhost:8080/api/v1/cameras \
  -H "Content-Type: application/json" \
  -d '{"brand":"Nikon","model":"FM2","format":"135"}'

curl -X POST http://localhost:8080/api/v1/film-rolls \
  -H "Content-Type: application/json" \
  -d '{"filmName":"Kodak Portra 400","brand":"Kodak","iso":400,"format":"135","loadedAt":"2026-03-01","cameraId":1,"pushPullStops":1}'
```

### 第 3 階段：寫入

| # | 檔案 | 重點 |
|---|---|---|
| 11 | `components/FieldError.tsx` | `aria-describedby` 的 id 要對得起來 |
| 12 | `hooks/useFilmRollMutations.ts` | 失效哪些 key（先用 `invalidateQueries`） |
| 13 | `components/FilmRollForm.tsx` | **最難的一支。** 數字欄位、日期欄位、空字串 vs undefined |
| 14 | `pages/FilmRollCreatePage.tsx` | 400 攤到欄位 vs 攤到 banner |

### 第 4 階段：補完

| # | 檔案 | 重點 |
|---|---|---|
| 15 | `hooks/useFilmRoll.ts` | `enabled` 擋掉 NaN id |
| 16 | `pages/FilmRollDetailPage.tsx` | 狀態推進、刪除後 `replace: true` |
| 17 | `pages/FilmRollEditPage.tsx` | 等資料到齊才 render 表單；409 的處理 |
| 18 | `components/FilmRollFilters.tsx` | `''` ↔ `undefined` 的轉換 |
| 19 | `components/Pagination.tsx` | 0-based vs 1-based |
| 20 | 各 `.module.css` | 樣式最後再調 |

### 收尾

- [x] 把 `tsconfig.app.json` 的 `noUnusedLocals` / `noUnusedParameters` 改回 `true`，
      清掉沒用到的 import
- [x] 刪掉各頁面裡的 `.placeholder` 區塊與對應 CSS
- [x] `npm run build` 與 `npm run lint` 都要綠

---

## 幾個一定會遇到的坑

先看過一遍，遇到時會省很多時間。各檔案的註解裡有更完整的說明。

**1. `?status=undefined`**
不篩選的正確表達是「不要帶這個參數」，不是「帶一個空值」。
`URLSearchParams` 遇到 `undefined` 會老實地寫成字串 `"undefined"`，
後端拿它比對 enum 然後回你 400。→ `api/http.ts` 的 `toQueryString`

**2. 日期少一天**
`new Date('2026-03-01')` 被當成 **UTC 午夜**，在負時區會顯示成 2/28。
`loadedAt` 是日曆上的一天，不是時間點，不該被時區轉換。→ `lib/format.ts`

**3. `Number('')` 是 0**
使用者把 ISO 欄位清空，你送出 `iso: 0`，後端 `@Positive` 擋下來，
但使用者看到的是一個空欄位 —— 完全不知道 0 從哪來。→ `components/FilmRollForm.tsx`

**4. PUT 不能整包展開**
後端開了 `fail-on-unknown-properties`，`{...roll, status: next}` 會混進
`id` / `createdAt` / `updatedAt`，直接 400。→ `types/filmRoll.ts`

**5. 改篩選條件要把 page 歸零**
從第 5 頁切到一個只有 2 頁的條件，你會看到一片空白，且沒有任何錯誤訊息。
→ `pages/FilmRollListPage.tsx`

**6. 新增成功但列表沒更新**
TanStack Query 不會自己知道你的 POST 影響了哪些查詢，必須明確
`invalidateQueries`。key 打錯字也會有一樣的症狀，而且不會報錯。
→ `hooks/queryKeys.ts`、右下角的 React Query Devtools

**7. 編輯頁表單是空的**
`useState(initialValues)` 的初始值只在第一次 mount 生效。
資料還沒到就 render 表單，之後資料到了 state 也不會更新。
→ `pages/FilmRollEditPage.tsx`

---

## 錯誤處理的兩條路

後端所有錯誤都是 RFC 9457 `application/problem+json`，但呈現方式該分兩種：

| 情境 | 狀態 | `errors` 陣列 | 呈現 |
|---|---|---|---|
| 欄位驗證失敗 | 400 | ✅ 有 | `FieldError`，攤到各欄位下方 |
| 跨欄位規則（日期順序） | 400 | ❌ 無 | `ErrorBanner` |
| 狀態逆向流轉 | 409 | ❌ 無 | `ErrorBanner`，文案要說「操作不成立」而非「填錯了」 |
| 查無資源 | 404 | ❌ 無 | 頁面級的「已被刪除」訊息 |
| 伺服器錯誤／離線 | 500 / — | ❌ 無 | `ErrorBanner` + 重試按鈕 |

關鍵區別：**400 是「你填錯了，改一下」，409 是「你填的沒錯，但這個操作對這筆資料不成立」。**
兩者的文案與出路完全不同，混在一起會讓使用者不知道該怎麼辦。

完整的錯誤契約見 [`../backend/README.md`](../backend/README.md#錯誤回應格式)。

---

## 開發時的幫手

**React Query Devtools** —— 右下角的浮動按鈕（僅開發模式）。
可以看到每個 query 的 key、狀態、快取內容與最後更新時間。
「為什麼新增後列表沒更新」幾乎都能在這裡一眼看出是 key 不對還是根本沒失效。

**Network 面板的請求量** —— `staleTime: 0`（預設）時，每次元件重新掛載、
視窗重新聚焦都會重抓。看到大量請求不一定是 bug，先確認 `staleTime` 設了沒。
