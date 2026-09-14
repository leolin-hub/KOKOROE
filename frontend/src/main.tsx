import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter } from 'react-router'
import App from './App'
import './index.css'
import { ApiError } from './api/problem'

/**
 * 全域的 QueryClient。
 *
 * 刻意建在 module 層級而非元件內部：若寫成 `const qc = new QueryClient()`
 * 放在元件裡，每次 re-render 都會生出一個新的 client，整個快取直接被丟掉。
 * 這是 TanStack Query 最經典的接線錯誤，症狀是「快取好像完全沒作用」。
 *
 * 為什麼 retry 要設在這裡而不是每個 hook：
 * 「4xx 不重試」是整個 app 都成立的政策，不是某一支 query 的特例。
 * 政策放全域，特例才放個別 hook —— 這樣看到某個 hook 有自己的 retry 設定時，
 * 你會知道「這裡一定有原因」。
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false
        return failureCount < 2
      },
      refetchOnWindowFocus: false,
    },
  },
})

const rootElement = document.getElementById('root')
if (!rootElement) {
  // index.html 若沒有 #root 就整個 app 起不來。與其讓 createRoot 丟出
  // 難懂的 null 錯誤，不如在這裡講清楚。
  throw new Error('找不到 #root 元素，請檢查 index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    {/*
      Provider 的順序：QueryClientProvider 在外、BrowserRouter 在內都可以，
      兩者互不依賴。但路由元件裡會用到 query hook，所以 QueryClientProvider
      不能比 BrowserRouter 更內層。
    */}
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      {/*
        Devtools：右下角會出現一個浮動按鈕，可以看到每個 query 的 key、
        狀態、快取內容與最後更新時間。
        學 TanStack Query 的時候這個東西的價值極高 —— 「為什麼沒更新」
        幾乎都能在這裡一眼看出是 key 不對還是根本沒失效。
        只在開發時掛載，正式 build 會被 tree-shake 掉。
      */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>,
)
