import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router'
import FilmRollsPage from './pages/FilmRollsPage'
import FilmRollDetailPage from './pages/FilmRollDetailPage'
import FilmRollCreatePage from './pages/FilmRollCreatePage'
import FilmRollEditPage from './pages/FilmRollEditPage'
import FilmRollPhotosPage from './pages/FilmRollPhotosPage'
import CameraListPage from './pages/CameraListPage'
import CameraCreatePage from './pages/CameraCreatePage'
import CameraEditPage from './pages/CameraEditPage'
import NotFoundPage from './pages/NotFoundPage'
import { CanisterDefs } from './components/FilmCanisterSvg'
import styles from './App.module.css'

/**
 * 應用外框與路由表。
 *
 * 路由設計：
 *   /                      → 重導到 /film-rolls
 *   /film-rolls            → 卷期頁，清單檢視（篩選與分頁放在 query string）
 *   /film-rolls?view=crate → 卷期頁，底片盒檢視（同一批卷期，一次看一卷）
 *   /film-rolls/new        → 新增
 *   /film-rolls/:id        → 詳情
 *   /film-rolls/:id/edit   → 編輯
 *   /film-rolls/:id/photos → 印樣（照片上傳與瀏覽；?photo=12 是放大檢視那一張）
 *   /crate                 → 舊網址，導向 /film-rolls?view=crate（保留原本的篩選）
 *   /cameras               → 相機列表
 *   /cameras/new           → 新增相機
 *   /cameras/:id/edit      → 編輯相機（含刪除；相機沒有獨立的詳情頁）
 *   *                      → 404
 *
 * 為什麼 `/new` 要排在 `/:id` 前面：
 * React Router 7+ 用的是 ranked matching（依具體程度排序，不是宣告順序），
 * 所以實際上它會自己判斷 `/new` 比 `/:id` 更具體而優先命中。
 * 但把它寫在前面仍有價值 —— 讀程式的人一眼就懂意圖，
 * 不需要先知道 ranked matching 這個規則。
 *
 * 為什麼篩選條件放 URL 而不是 useState：
 * 「篩選 LOADED 的第 2 頁」應該是一個可以貼給別人、可以加書籤、
 * 按上一頁會回到的狀態。放進 component state 這三件事全都做不到。
 * 凡是「使用者會期待重新整理後還在」的狀態，都屬於 URL。
 */
export default function App() {
  return (
    <div className={styles.app}>
      {/* 所有底片罐共用的漸層與裁切區，整個 app 只放一份 */}
      <CanisterDefs />
      <header className={styles.header}>
        <Link to="/film-rolls" className={styles.brand}>
          kokoroe
        </Link>
        {/*
          NavLink 會在網址符合時把 className 函式的 isActive 設為 true，並自動加上 aria-current="page"。
          /film-rolls/7 也算在「卷期」底下：NavLink 預設比對的是路徑前綴，不需要 end。
        */}
        <nav className={styles.nav} aria-label="主要導覽">
          <NavLink
            to="/film-rolls"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            卷期
          </NavLink>
          <NavLink
            to="/cameras"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            相機
          </NavLink>
        </nav>
      </header>

      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Navigate to="/film-rolls" replace />} />
          <Route path="/film-rolls" element={<FilmRollsPage />} />
          <Route path="/film-rolls/new" element={<FilmRollCreatePage />} />
          <Route path="/film-rolls/:id" element={<FilmRollDetailPage />} />
          <Route path="/film-rolls/:id/edit" element={<FilmRollEditPage />} />
          <Route path="/film-rolls/:id/photos" element={<FilmRollPhotosPage />} />
          <Route path="/crate" element={<LegacyCrateRedirect />} />
          <Route path="/cameras" element={<CameraListPage />} />
          <Route path="/cameras/new" element={<CameraCreatePage />} />
          <Route path="/cameras/:id/edit" element={<CameraEditPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  )
}

/**
 * 舊網址 `/crate` 導向卷期頁的底片盒檢視，原本的篩選一起帶過去：
 *   /crate?status=LOADED → /film-rolls?status=LOADED&view=crate
 * `replace` 把舊網址從瀏覽紀錄換掉，按上一頁才不會又被導回來、卡在原地。
 */
function LegacyCrateRedirect() {
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  params.set('view', 'crate')
  return <Navigate to={`/film-rolls?${params}`} replace />
}
