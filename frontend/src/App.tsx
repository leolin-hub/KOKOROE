import { Link, Navigate, Route, Routes } from 'react-router'
import FilmRollListPage from './pages/FilmRollListPage'
import FilmRollDetailPage from './pages/FilmRollDetailPage'
import FilmRollCreatePage from './pages/FilmRollCreatePage'
import FilmRollEditPage from './pages/FilmRollEditPage'
import NotFoundPage from './pages/NotFoundPage'
import styles from './App.module.css'

/**
 * 應用外框與路由表。
 *
 * 路由設計：
 *   /                      → 重導到 /film-rolls
 *   /film-rolls            → 列表（篩選與分頁放在 query string）
 *   /film-rolls/new        → 新增
 *   /film-rolls/:id        → 詳情
 *   /film-rolls/:id/edit   → 編輯
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
      <header className={styles.header}>
        <Link to="/film-rolls" className={styles.brand}>
          kokoroe
        </Link>
        <span className={styles.tagline}>底片與器材履歷</span>
      </header>

      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Navigate to="/film-rolls" replace />} />
          <Route path="/film-rolls" element={<FilmRollListPage />} />
          <Route path="/film-rolls/new" element={<FilmRollCreatePage />} />
          <Route path="/film-rolls/:id" element={<FilmRollDetailPage />} />
          <Route path="/film-rolls/:id/edit" element={<FilmRollEditPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  )
}
