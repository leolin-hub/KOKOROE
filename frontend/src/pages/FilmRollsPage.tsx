import { Link, useSearchParams } from 'react-router'
import { parseView } from '../lib/listParams'
import ViewToggle from '../components/ViewToggle'
import FilmRollListPage from './FilmRollListPage'
import CrateBrowserPage from './CrateBrowserPage'
import styles from './FilmRollsPage.module.css'

/**
 * 卷期頁。路由 `/film-rolls`，兩種檢視看的是同一批卷期：
 *   /film-rolls             清單：一頁 20 張卡片、分頁，適合快速掃過、找某一卷、看整體狀態
 *   /film-rolls?view=crate  底片盒：一次專注看一卷、一路往下捲，適合慢慢翻
 *
 * 為什麼合成一頁，而不是導覽列上「卷期」「底片盒」兩個入口：
 *   兩邊列出的卷期、篩選、排序、點進去的詳情頁完全一樣，只差「怎麼看」。
 *   分成兩頁的話，使用者會納悶兩個長得不一樣、內容卻一樣的頁面差在哪。
 *   合成一頁之後，切換檢視時篩選條件也會跟著保留。
 *
 * 這一層只負責共用的標題列（標題、檢視切換、新增按鈕）；篩選、內容、分頁或捲動都在各自的檢視裡。
 * 舊的 `/crate` 網址在 App.tsx 導向 `?view=crate`，以前的書籤和連結不會壞。
 */
export default function FilmRollsPage() {
  const [searchParams] = useSearchParams()
  const view = parseView(searchParams.get('view'))

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>我的卷期</h1>
        <div className={styles.actions}>
          <ViewToggle view={view} />
          <Link to="/film-rolls/new" className={styles.newButton}>
            裝新的一卷
          </Link>
        </div>
      </div>

      {view === 'crate' ? <CrateBrowserPage /> : <FilmRollListPage />}
    </div>
  )
}
