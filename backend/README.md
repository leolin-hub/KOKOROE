# Kokoroe Backend

底片攝影與器材履歷管理系統的後端服務。

- **Java 21** / **Spring Boot 4.0.8** / Spring Data JPA / PostgreSQL 16 / Flyway
- 分層架構：`Controller`（路由 + `@Valid`）→ `Service`（商業邏輯）→ `Repository`（資料存取）
- `@Entity` 不外洩至 API 層，一律經 DTO 轉換

---

## 快速啟動

```bash
# 1. 從專案根目錄啟動 PostgreSQL 16
cd ..
cp .env.example .env      # 首次執行才需要
docker compose up -d

# 2. 啟動後端
cd backend
./mvnw spring-boot:run    # Windows: .\mvnw.cmd spring-boot:run
```

服務啟動於 `http://localhost:8080`。

執行測試（整合測試會自動起一個 Testcontainers 的 PostgreSQL 容器，需要 Docker 在運行）：

```bash
./mvnw test
```

---

## API 契約 v1

Base path：`/api/v1/film-rolls`
錯誤回應一律為 **RFC 9457 `application/problem+json`**。

| Method | Path | Request Body | 成功 | 可能的錯誤 |
|---|---|---|---|---|
| `POST` | `/api/v1/film-rolls` | `CreateFilmRollRequest` | `201` + `Location` header | `400` |
| `GET` | `/api/v1/film-rolls` | — | `200` `PageResponse<FilmRollResponse>` | `400` |
| `GET` | `/api/v1/film-rolls/{id}` | — | `200` `FilmRollResponse` | `400` `404` |
| `PUT` | `/api/v1/film-rolls/{id}` | `UpdateFilmRollRequest` | `200` `FilmRollResponse` | `400` `404` `409` |
| `DELETE` | `/api/v1/film-rolls/{id}` | — | `204` | `400` `404` |

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
  "cameraName": "Nikon FM2",
  "lensName": "50mm f/1.4",
  "notes": "櫻花季，推一格",
  "status": "LOADED",
  "createdAt": "2026-03-01T09:12:33.512Z",  // ISO-8601 instant (UTC)
  "updatedAt": "2026-03-01T09:12:33.512Z"
}
```

> `default-property-inclusion: non_null` —— 值為 `null` 的欄位不會出現在回應中。
> 前端 TypeScript interface 對應時，可為 null 的欄位請標為 optional（`?`）。

### 請求欄位驗證規則

| 欄位 | 必填 | 規則 |
|---|---|---|
| `filmName` | ✅ | 非空白，≤ 100 字 |
| `brand` | | ≤ 50 字 |
| `iso` | ✅ | 正整數，≤ 12800 |
| `format` | ✅ | `"135"` 或 `"120"` |
| `pushPullStops` | | `-3` ~ `3`，未填預設 `0` |
| `loadedAt` | ✅ | ISO-8601 日期 |
| `finishedAt` | | 不得早於 `loadedAt` |
| `cameraName` / `lensName` | | ≤ 100 字 |
| `notes` | | ≤ 2000 字 |
| `status` | POST 選填 / PUT 必填 | POST 未填預設 `LOADED` |

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
| `urn:kokoroe:problem:business-rule-violated` | 400 / 409 | 跨欄位規則或狀態衝突 |
| `urn:kokoroe:problem:malformed-request` | 400 | JSON 格式或參數型別錯誤 |
| `urn:kokoroe:problem:resource-not-found` | 404 | 查無資源 |
| `urn:kokoroe:problem:internal-error` | 500 | 非預期錯誤（細節僅入 log） |

---

## 資料庫

Schema 由 **Flyway** 管理（`src/main/resources/db/migration/`），
Hibernate 設為 `ddl-auto: validate`，只校驗不改結構。

**新增欄位的流程**：寫一支新的 `V{n}__description.sql` → 同步調整 Entity → 跑測試。
永遠不要修改已經執行過的 migration 檔案。

---

## 目前進度

後端第一階段刻意限定在 `FilmRoll` 單一實體，`cameraName` / `lensName` 先以字串儲存。

| 項目 | 狀態 |
|---|---|
| 後端 `FilmRoll` CRUD（本文件描述的範圍） | ✅ 完成 |
| CI：GitHub Actions（後端 `mvnw test`；前端 lint、型別檢查、build）與 Dependabot | ✅ 完成 |
| 前端垂直切片（Vite + React + TS + TanStack Query） | 🚧 進行中，見下方 |
| 拆出 `Camera` / `Lens` 實體，並以 Flyway migration 搬遷既有資料 | ⏳ 未開始 |
| 沖掃成果（掃描圖檔）管理 | ⏳ 未開始 |
| 容器化與部署（CD） | ⏳ 未開始 |

### 前端進度

實作順序與各檔案說明見 [`frontend/README.md`](../frontend/README.md)。前端拆成兩支 PR：

**讀取路徑**（`feat/frontend-read-path`，進行中）

- ✅ API 層：`http.ts`（fetch 封裝、problem+json 解析、204 處理）、`filmRolls.ts`、`problem.ts`
- ✅ `QueryClient` 全域設定（4xx 不重試、5xx 最多重試 2 次）與 `useFilmRolls` / `useFilmRoll`
- ✅ `lib/format.ts`（LocalDate 以字串處理不經過 `Date`、Instant 轉當地時間到分鐘）
- ⏳ `StatusBadge` → `ErrorBanner` → `FilmRollCard` → 列表頁 → 篩選 → 分頁

**寫入路徑**（下一支分支）

- ⏳ mutations、`FieldError`、`FilmRollForm`、新增／詳情／編輯頁
