import { Link, useSearchParams } from 'react-router'
import type { RollsView } from '../lib/listParams'
import styles from './ViewToggle.module.css'

interface ViewToggleProps {
  view: RollsView
}

/**
 * 卷期頁右上角的「清單 ｜ 底片盒」切換。
 *
 * 用連結而不是按鈕：檢視方式寫在網址上（`?view=crate`），切換就是換網址，
 * 上一頁、重新整理、開新分頁都會停在同一個檢視。
 *
 * 切換時保留篩選與排序（status、sort），兩種檢視看的是同一批卷期；
 * 但 `page` 只有清單在用（底片盒是一路往下捲的），切到底片盒時拿掉，切回清單時從第一頁開始。
 */
export default function ViewToggle({ view }: ViewToggleProps) {
  const [searchParams] = useSearchParams()

  const listParams = new URLSearchParams(searchParams)
  listParams.delete('view')
  listParams.delete('page')

  const crateParams = new URLSearchParams(searchParams)
  crateParams.set('view', 'crate')
  crateParams.delete('page')

  const options: { view: RollsView; label: string; search: string }[] = [
    { view: 'list', label: '清單', search: listParams.toString() },
    { view: 'crate', label: '底片盒', search: crateParams.toString() },
  ]

  return (
    <nav className={styles.toggle} aria-label="檢視方式">
      {options.map((option) => (
        <Link
          key={option.view}
          to={{ search: option.search ? `?${option.search}` : '' }}
          className={styles.option}
          aria-current={option.view === view ? 'page' : undefined}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  )
}
