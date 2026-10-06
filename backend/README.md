# Kokoroe Backend

底片攝影與器材履歷管理系統的後端服務。

- **Java 21** / **Spring Boot 4.1.1** / Spring Data JPA / PostgreSQL 16 / Flyway
- 分層架構：`Controller`（路由 + `@Valid`）→ `Service`（商業邏輯）→ `Repository`（資料存取）
- `@Entity` 不外洩至 API 層，一律經 DTO 轉換

---

## 快速啟動

```bash
# 1. 從專案根目錄啟動 PostgreSQL 16 與 RustFS（照片的 S3 相容儲存）
cd ..
cp .env.example .env      # 首次執行才需要
docker compose up -d

# 2. 啟動後端
cd backend
./mvnw spring-boot:run    # Windows: .\mvnw.cmd spring-boot:run
```

服務啟動於 `http://localhost:8080`。第一次啟動會自動在 RustFS 建立 `kokoroe-photos` bucket。
RustFS 管理介面在 `http://localhost:9001`（帳密 `kokoroe` / `kokoroe-secret`），可以直接看上傳的檔案。

執行測試（整合測試會自動起 Testcontainers 的 PostgreSQL 與 RustFS 容器，需要 Docker 在運行）：

```bash
./mvnw test
```

健康檢查：`GET /actuator/health` 只回 `{"status":"UP"}`（DB 連不上時是 `503` 和 `DOWN`），其他 actuator 端點都沒有開放。

正式環境用 `SPRING_PROFILES_ACTIVE=prod`（`application-prod.yml`）：資料庫與 R2 的設定一律從環境變數讀，沒有開發用的預設值；log 等級降到 info。部署方式見 [`deploy/README.md`](../deploy/README.md)。

---

## API 契約 v1

Base path：`/api/v1`
錯誤回應一律為 **RFC 9457 `application/problem+json`**。

### 卷期（`/film-rolls`）

| Method | Path | Request Body | 成功 | 可能的錯誤 |
|---|---|---|---|---|
| `POST` | `/api/v1/film-rolls` | `CreateFilmRollRequest` | `201` + `Location` header | `400` |
| `GET` | `/api/v1/film-rolls` | — | `200` `PageResponse<FilmRollResponse>` | `400` |
| `GET` | `/api/v1/film-rolls/{id}` | — | `200` `FilmRollResponse` | `400` `404` |
| `PUT` | `/api/v1/film-rolls/{id}` | `UpdateFilmRollRequest` | `200` `FilmRollResponse` | `400` `404` `409` |
| `DELETE` | `/api/v1/film-rolls/{id}` | — | `204` | `400` `404` |

### 相機（`/cameras`）

| Method | Path | Request Body | 成功 | 可能的錯誤 |
|---|---|---|---|---|
| `POST` | `/api/v1/cameras` | `CreateCameraRequest` | `201` + `Location` header | `400` `409`（同名） |
| `GET` | `/api/v1/cameras` | — | `200` `PageResponse<CameraResponse>` | `400` |
| `GET` | `/api/v1/cameras/{id}` | — | `200` `CameraResponse` | `400` `404` |
| `PUT` | `/api/v1/cameras/{id}` | `UpdateCameraRequest` | `200` `CameraResponse` | `400` `404` `409`（同名） |
| `DELETE` | `/api/v1/cameras/{id}` | — | `204` | `400` `404` `409`（還有卷期使用中） |

相機列表預設 `size=100`、`sort=brand,asc&sort=model,asc`，前端下拉選單打一次就能拿到全部。

### 照片（`/film-rolls/{id}/photos`、`/photos`）

| Method | Path | Request | 成功 | 可能的錯誤 |
|---|---|---|---|---|
| `GET` | `/api/v1/film-rolls/{id}/photos` | — | `200` `PhotoResponse[]`（依格號排序，不分頁） | `400` `404`（卷期） |
| `POST` | `/api/v1/film-rolls/{id}/photos` | `multipart/form-data`：`file`（JPEG）、`frameNumber`（選填） | `201` `PhotoResponse` + `Location` | `400` `404` `409`（該格已有照片） `413`（> 40 MB） `415` `503`（處理中的上傳已滿） |
| `GET` | `/api/v1/photos/{id}` | — | `200` `PhotoResponse` | `400` `404` |
| `GET` | `/api/v1/photos/{id}/{variant}` | `variant` = `thumb` / `web` / `original` | `200` `image/jpeg` | `400` `404` |
| `DELETE` | `/api/v1/photos/{id}` | — | `204` | `400` `404` |

- **一次傳一張**。只收 JPEG，以檔頭判斷（不看副檔名或 Content-Type）；超過 4000 萬像素拒絕。
- **格號**：有給 `frameNumber`（0–99）就用；沒給就取檔名最後一組數字（`000123_07.jpg` → 7）；
  再沒有就接在目前最大格號後面。同一卷同一格只能一張，要換先刪。
- **三個版本**：`thumb` 長邊 480、`web` 長邊 2048（都依 EXIF 轉正、不帶 EXIF），`original` 原封不動。
  圖檔由後端轉送，`Cache-Control: private, max-age=31536000, immutable`。
- 刪除卷期會一併刪除它的照片紀錄與圖檔。

```jsonc
// PhotoResponse
{
  "id": 12,
  "filmRollId": 7,
  "frameNumber": 7,
  "originalFilename": "000123_07.jpg",
  "width": 3000,        // 依 EXIF 轉正後的原圖尺寸，前端用來算長寬比
  "height": 2000,
  "sizeBytes": 4812345,
  "createdAt": "2026-10-02T04:58:27.314094Z"
}
```

### 查詢參數（`GET /api/v1/film-rolls`）

| 參數 | 型別 | 預設 | 說明 |
|---|---|---|---|
| `status` | `LOADED` \| `SHOOTING` \| `DEVELOPING` \| `ARCHIVED` | 不篩選 | 依狀態篩選 |
| `page` | int | `0` | 頁碼（0-based） |
| `size` | int | `20` | 每頁筆數，上限 `100` |
| `sort` | string | `loadedAt,desc` | 例如 `sort=iso,asc` |

### `FilmRollResponse`

```jsonc
{
  "id": 1,
  "filmName": "Kodak Portra 400",
  "brand": "Kodak",
  "iso": 400,
  "format": "135",            // "135" | "120"
  "pushPullStops": 1,         // -3 ~ +3，正數推感、負數減感
  "loadedAt": "2026-03-01",   // ISO-8601 date
  "finishedAt": null,         // 仍在拍攝中時為 null
  "camera": { "id": 3, "name": "Nikon FM2" },  // 沒指定相機時不出現
  "lensName": "50mm f/1.4",
  "notes": "櫻花季，推一格",
  "status": "LOADED",
  "createdAt": "2026-03-01T09:12:33.512Z",  // ISO-8601 instant (UTC)
  "updatedAt": "2026-03-01T09:12:33.512Z"
}
```

> `default-property-inclusion: non_null` —— 值為 `null` 的欄位不會出現在回應中。
> 前端 TypeScript interface 對應時，可為 null 的欄位請標為 optional（`?`）。

### `CameraResponse`

```jsonc
{
  "id": 3,
  "brand": "PENTAX",                // 可省略
  "model": "PG-50",
  "name": "PENTAX PG-50",           // 顯示用：「品牌 型號」
  "format": "135",                  // "135" | "120" | "half-frame"
  "cameraType": "POINT_AND_SHOOT",  // POINT_AND_SHOOT | SLR | RANGEFINDER | TLR | DISPOSABLE | OTHER
  "focusType": "AUTO",              // AUTO | MANUAL | FIXED | ZONE
  "filmAdvance": "AUTO",            // MANUAL | AUTO
  "hasFlash": true,
  "interchangeableLens": false,
  "fixedLens": "35mm f/4.5",        // 內建鏡頭；可換鏡頭的機身不會有
  "shutterSpeedRange": "1/60–1/250",
  "isoMin": 100,
  "isoMax": 400,
  "notes": "DX 自動讀取感光度",
  "createdAt": "2026-09-16T09:12:33.512Z",
  "updatedAt": "2026-09-16T09:12:33.512Z"
}
```

只有 `model`、`format` 必填，其餘欄位都可以不填，沒填代表「還不知道」。

### 卷期請求欄位驗證規則

| 欄位 | 必填 | 規則 |
|---|---|---|
| `filmName` | ✅ | 非空白，≤ 100 字 |
| `brand` | | ≤ 50 字 |
| `iso` | ✅ | 正整數，≤ 12800 |
| `format` | ✅ | `"135"` 或 `"120"` |
| `pushPullStops` | | `-3` ~ `3`，未填預設 `0` |
| `loadedAt` | ✅ | ISO-8601 日期 |
| `finishedAt` | | 不得早於 `loadedAt` |
| `cameraId` | | 必須是已存在的相機；相機片幅要能裝這個 `format`（半格機裝 `135`） |
| `lensName` | | ≤ 100 字 |
| `notes` | | ≤ 2000 字 |
| `status` | POST 選填 / PUT 必填 | POST 未填預設 `LOADED` |

### 相機請求欄位驗證規則

| 欄位 | 必填 | 規則 |
|---|---|---|
| `brand` | | ≤ 50 字 |
| `model` | ✅ | 非空白，≤ 100 字 |
| `format` | ✅ | `"135"`、`"120"` 或 `"half-frame"` |
| `fixedLens` / `shutterSpeedRange` | | ≤ 100 / ≤ 50 字；`interchangeableLens` 為 `true` 時不可填 `fixedLens` |
| `isoMin` / `isoMax` | | 正整數，≤ 12800，下限不可大於上限 |
| `notes` | | ≤ 2000 字 |

品牌與型號會去頭尾空白、連續空白壓成一個；**同品牌同型號（不分大小寫）只能有一台**，重複回 `409`。

### 狀態流轉規則

```
LOADED ──> SHOOTING ──> DEVELOPING ──> ARCHIVED
   └──────────┴───────────────┴──> （允許向前跳關）
```

只能向前推進或維持不變。**逆向流轉回傳 `409 Conflict`**（而非 400）——
請求本身合法，是資源目前的狀態不允許該操作。

### 錯誤回應格式

驗證失敗（`400`）會額外帶一個 `errors` 陣列，可直接對應到表單欄位：

```jsonc
{
  "type": "urn:kokoroe:problem:validation-failed",
  "title": "輸入驗證失敗",
  "status": 400,
  "detail": "有 2 個欄位未通過驗證，詳見 errors",
  "timestamp": "2026-03-01T09:12:33.512Z",
  "errors": [
    { "field": "filmName", "message": "底片名稱不可為空" },
    { "field": "iso", "message": "ISO 感光度必須為正整數" }
  ]
}
```

| `type` | 狀態 | 意義 |
|---|---|---|
| `urn:kokoroe:problem:validation-failed` | 400 | 欄位驗證未通過 |
| `urn:kokoroe:problem:business-rule-violated` | 400 / 409 | 跨欄位規則、狀態衝突、同名相機、相機使用中、照片不合法、該格已有照片 |
| `urn:kokoroe:problem:malformed-request` | 400 / 405 / 413 / 415 | JSON 或 multipart 格式錯誤、參數型別錯誤、方法或 Content-Type 不支援、檔案太大 |
| `urn:kokoroe:problem:resource-not-found` | 404 | 查無資源 |
| `urn:kokoroe:problem:service-busy` | 503 | 同時處理中的上傳已滿，稍後重試 |
| `urn:kokoroe:problem:internal-error` | 500 | 非預期錯誤（細節僅入 log） |

---

## 資料庫

Schema 由 **Flyway** 管理（`src/main/resources/db/migration/`），
Hibernate 設為 `ddl-auto: validate`，只校驗不改結構。

**新增欄位的流程**：寫一支新的 `V{n}__description.sql` → 同步調整 Entity → 跑測試。
永遠不要修改已經執行過的 migration 檔案。

---

## 目前進度

後端第一階段刻意限定在 `FilmRoll` 單一實體；第二階段拆出 `Camera`，`lensName` 仍以字串儲存（目前的相機多為定焦機）。

| 項目 | 狀態 |
|---|---|
| 後端 `FilmRoll` CRUD（本文件描述的範圍） | ✅ 完成 |
| CI：GitHub Actions（後端 `mvnw test`；前端 lint、型別檢查、build）與 Dependabot | ✅ 完成 |
| 前端垂直切片（Vite + React + TS + TanStack Query） | 🚧 進行中，見下方 |
| 唱片櫃式卷期瀏覽（垂直捲動、當前卷期放大、無限捲動） | ✅ 完成（`/crate`，頁面名稱「底片盒」；寫實 SVG 底片罐改版） |
| 拆出 `Camera` 實體（`/api/v1/cameras`），V2 migration 把舊的 `camera_name` 去重搬進 `camera` 並回填 | ✅ 完成（前端表單改為相機下拉選單；V3 移除舊欄位 `camera_name`，沒連上相機的舊名稱補進備註） |
| 相機管理頁（`/cameras` 列表、新增、編輯與刪除） | ✅ 完成 |
| 拆出 `Lens` 實體 | ⏳ 未開始 |
| 沖掃成果（掃描圖檔）管理 | ✅ 完成：後端 API（V4 `photo` 表、RustFS / R2、縮圖與網頁版）、前端上傳、印樣、放大檢視，以及底片盒的底片條攤開動畫 |
| 容器化與部署（CD） | 🚧 設定檔完成，等 VM 與 Cloudflare 設好後第一次上線：後端與前端（Caddy）image、`deploy/compose.prod.yml`、Cloudflare Tunnel + Access、R2、每日備份、`deploy.yml`（arm64 → GHCR → 經 Tunnel SSH 部署）。手冊見 [`deploy/README.md`](../deploy/README.md) |

### 前端進度

實作順序與各檔案說明見 [`frontend/README.md`](../frontend/README.md)。前端拆成兩支 PR：

**讀取路徑**（`feat/frontend-read-path`，已合併）

- ✅ API 層：`http.ts`（fetch 封裝、problem+json 解析、204 處理）、`filmRolls.ts`、`problem.ts`
- ✅ `QueryClient` 全域設定（4xx 不重試、5xx 最多重試 2 次）與 `useFilmRolls` / `useFilmRoll`
- ✅ `lib/format.ts`（LocalDate 以字串處理不經過 `Date`、Instant 轉當地時間到分鐘）
- ✅ `StatusBadge`、`ErrorBanner`（5xx／網路錯誤才可重試）、`FilmRollCard`
- ✅ 列表頁（篩選／排序／分頁狀態放在 URL、四種載入狀態）、`FilmRollFilters`、`Pagination`

**寫入路徑**（`feat/frontend-write-path`，已合併）

- ✅ `useCreateFilmRoll` / `useUpdateFilmRoll` / `useDeleteFilmRoll`（成功後失效列表與詳情快取）
- ✅ `FieldError`、`FilmRollForm`（新增與編輯共用，輸入限制與後端驗證一致）
- ✅ 新增頁、詳情頁（推進狀態、刪除）、編輯頁；`lib/toUpdateRequest.ts`
- ✅ 收尾：`noUnusedLocals` / `noUnusedParameters` 改回 `true`、清除骨架的 TODO 與 placeholder、`npm run build` 與 `npm run lint` 通過

**相機**（`feat/backend-camera-entity`，已合併；`feat/frontend-camera-management`）

- ✅ 卷期表單的相機改為下拉選單（`useCameras`，裝不了目前底片規格的相機設為 disabled）
- ✅ 相機管理頁：列表（規格摘要）、新增、編輯（含刪除，使用中回 409 顯示原因）；上方導覽列加入「卷期／相機」
- ✅ 表單共用元件抽出：`FormField`、`Form.module.css`、`FormPage.module.css`

**唱片櫃**（`feat/frontend-crate-browser`）

- ✅ `/crate`：scroll-snap 垂直捲動，焦點卷期放大、其他依距離往後傾；計數「第 N / 總數 卷」
- ✅ `useInfiniteFilmRolls`：捲到倒數第 3 卷自動載入下一批；篩選與排序沿用列表頁的 URL 參數（`lib/listParams.ts`）
- ✅ 鍵盤操作（↑ ↓ Home End Enter）、非焦點卷期的連結不進 Tab 順序、`prefers-reduced-motion`（`usePrefersReducedMotion`）
- ✅ `RollArtwork`：有對照表的底片顯示照片，否則畫 SVG 底片罐（`FilmCanisterSvg`、`canisterColors`）
- ✅ 從唱片櫃進詳情頁時，「← 回到唱片櫃」帶回原本的篩選（`lib/backLink.ts`，經過編輯、刪除也保留）

**底片盒改版**（`feat/frontend-crate-redesign`，頁面從「唱片櫃」改名為「底片盒」）

- ✅ 每一卷畫成寫實的 SVG 135 底片罐：略俯視的橢圓頂蓋、標籤包覆在圓柱上、光影、片頭與遮光絨；焦點卷期滑鼠移上去會轉。唱片櫃不再用照片
- ✅ 標籤資料：三層配色（款式 → 品牌 → 雜湊，`canisterPalette`）、從片名推測彩色／黑白／正片（`guessFilmType`）、依 Wikipedia 表的 DX 編碼（`dxCode`）
- ✅ 整站配色換成冷調炭黑；導覽列、底片盒拿掉分隔線，表單欄位框線與狀態色調到符合 WCAG 對比
- ✅ 字型 Archivo、IBM Plex Mono 以 fontsource 打包進專案

**卷期頁合併兩種檢視**（`feat/frontend-rolls-view-toggle`）

- ✅ 「卷期」與「底片盒」看的是同一批卷期，合併成一頁：右上角 [清單 | 底片盒] 切換，篩選與排序跟著保留
- ✅ 底片盒網址改為 `/film-rolls?view=crate`；舊的 `/crate` 導過去並保留篩選，詳情頁「← 回到底片盒」也跟著改

**卷期照片**（`feat/frontend-roll-photos`）

- ✅ 印樣頁 `/film-rolls/:id/photos`：米白相紙上排著黑色底片條（135 一條 6 格、120 一條 3 格），片孔、片邊印著底片名稱與格號；窄螢幕左右捲動
- ✅ 上傳：拖曳或選檔，一張一張依序上傳、每張顯示自己的狀態（排隊中／上傳中／第 N 格／失敗原因），網路或伺服器錯誤可重試；上傳中關分頁會先詢問
- ✅ 放大檢視：原生 `<dialog>`，← → 切換、Esc 關閉、下載原檔、刪除；正在看哪一張放在網址（`?photo=`），重新整理還在
- ✅ 詳情頁新增「照片」區塊：前六張縮圖與印樣頁入口
- ✅ 底片與相紙的顏色抽成共用 token（`--film-*`、`--paper`），之後的底片條動畫沿用

**底片條攤開**（`feat/frontend-roll-unroll`）

- ✅ 底片盒裡點焦點卷期的罐子（或按 Enter），底片條從右側出片口拉出來（900ms），第 1 格在最外面、片頭在最前端，一次露出 4 格；出片口附近浮現漏光光暈
- ✅ 拖曳、觸控板左右滑或按 ← → 繼續拉出後面的格；點任一格就地打開放大檢視；Esc 或再點罐子收回，換到別卷時自動收回
- ✅ 底片條下方是片邊樣式的資訊欄：片名、ISO、張數、相機，以及「看全部（印樣）」與「詳情」連結；沒有照片時拉出空白底片並改成「上傳掃描檔」
- ✅ 點非焦點卷期的罐子會捲過去讓它變成焦點；放大檢視的換張、刪除邏輯抽成 `usePhotoLightbox`，印樣頁與底片盒共用
