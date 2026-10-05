import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { uploadPhoto } from '../api/photos'
import { ApiError, toUserMessage } from '../api/problem'
import { insertByFrame, rejectReason } from '../lib/photoUpload'
import { photoKeys } from './queryKeys'
import type { PhotoResponse } from '../types/photo'

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'failed'

/** 佇列裡的一個檔案。 */
export interface UploadItem {
  /** React 列表的 key。同名檔案可能被選兩次，不能用檔名 */
  key: number
  file: File
  rollId: number
  status: UploadStatus
  /** 失敗時給使用者看的原因 */
  error?: string
  /**
   * 失敗後值不值得重試。規則和 ErrorBanner 相同：網路錯誤、逾時與 5xx（含 503 忙碌）才值得；
   * 4xx（不是 JPEG、這格已有照片）重試一百次結果都一樣。
   */
  retryable?: boolean
  /** 上傳成功後，後端建立的照片（用來顯示「第 7 格」） */
  photo?: PhotoResponse
}

export interface PhotoUploadQueue {
  items: UploadItem[]
  /** 加入一批檔案。不合格的直接標成失敗，其餘排隊依序上傳 */
  enqueue: (files: Iterable<File>) => void
  /** 把失敗的那一個重新排回佇列 */
  retry: (key: number) => void
  /** 從清單拿掉已完成的，只留下還在跑或失敗的 */
  clearFinished: () => void
  /** 還有沒有沒跑完的（排隊中或上傳中） */
  isBusy: boolean
}

/**
 * 一張照片最多等多久。網路卡住時不讓整個佇列永遠停在「上傳中」。
 * 5 分鐘：40 MB 的檔案在上傳頻寬 1 Mbps 的網路也傳得完。
 */
const UPLOAD_TIMEOUT_MS = 5 * 60_000

/**
 * 照片上傳佇列：一次只傳一張，一張接一張。
 *
 * ── 為什麼一次一張 ──
 * 後端同時只處理一張（解碼大照片很吃記憶體），一次送十張只會讓九張在伺服器排隊、
 * 等太久還會收到 503。依序送，每張都有自己明確的成功或失敗，失敗的也能單獨重試。
 *
 * ── 為什麼不用 useMutation ──
 * useMutation 一次只追蹤「最近一次」呼叫的狀態，這裡要同時顯示幾十個檔案各自的狀態，
 * 所以自己用 state 存一份清單。
 *
 * ── 佇列怎麼跑 ──
 * `pendingRef` 是還沒送的檔案，`drain()` 是一個 while 迴圈，一張一張拿出來 await 上傳，
 * 拿完就停。`runningRef` 確保同時只有一個迴圈在跑：迴圈跑著時再加檔案，只要放進 pendingRef，
 * 正在跑的迴圈自然會拿到。
 * 這兩個用 ref 而不是 state：它們是「迴圈內部的工作狀態」，改了不需要重畫畫面，
 * 而且 async 迴圈裡讀 state 會讀到舊值（closure 抓住的是當時那一份），ref 永遠是最新的。
 * 畫面要顯示的是 `items`（state），每個檔案狀態改變時用 `patch` 更新。
 *
 * ── 離開頁面 ──
 * 元件卸載時取消正在傳的那張、清空排隊中的：佇列跟著頁面走，回到頁面時是一份新的佇列，
 * 不會有「看不到的舊迴圈」和新迴圈同時上傳。已經傳完的照片都在，不受影響。
 * 關分頁、重新整理也會中斷，所以頁面在 `isBusy` 時用 beforeunload 提醒。
 */
export function usePhotoUploadQueue(rollId: number): PhotoUploadQueue {
  const queryClient = useQueryClient()
  const [items, setItems] = useState<UploadItem[]>([])
  const pendingRef = useRef<UploadItem[]>([])
  const runningRef = useRef(false)
  const nextKeyRef = useRef(1)
  /**
   * 排隊中或上傳中的 key。retry 用它擋重複：迴圈會把檔案從 pendingRef 取出來，
   * 所以「只看 pendingRef」擋不住「已經在傳」的那一個。
   */
  const activeKeysRef = useRef(new Set<number>())
  /** 元件卸載時 abort，取消正在傳的那張 */
  const unmountRef = useRef(new AbortController())

  useEffect(() => {
    // StrictMode 在開發時會「掛上 → 卸載 → 再掛上」一次，所以每次掛上都換一個新的 controller，
    // 不然第一次假卸載就把它 abort 掉了，之後每張上傳都會立刻被取消
    const controller = new AbortController()
    unmountRef.current = controller
    // 陣列和 Set 本身從頭到尾是同一個物件（只會被 push / add / 清空，不會換掉），先取出來；
    // cleanup 裡再讀 ref.current 的話，lint 會提醒那時候的值可能已經變了
    const pending = pendingRef.current
    const activeKeys = activeKeysRef.current
    return () => {
      controller.abort()
      pending.length = 0
      activeKeys.clear()
    }
  }, [])

  function patch(key: number, changes: Partial<UploadItem>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...changes } : item)))
  }

  async function drain() {
    if (runningRef.current) return
    runningRef.current = true
    const touchedRolls = new Set<number>()
    try {
      for (let item = pendingRef.current.shift(); item; item = pendingRef.current.shift()) {
        patch(item.key, { status: 'uploading', error: undefined })
        touchedRolls.add(item.rollId)
        const signal = AbortSignal.any([unmountRef.current.signal, AbortSignal.timeout(UPLOAD_TIMEOUT_MS)])
        try {
          const photo = await uploadPhoto(item.rollId, item.file, signal)
          patch(item.key, { status: 'done', photo, retryable: undefined })
          // 直接放進快取，印樣上馬上出現這一格，不必等重抓。
          // 快取還沒有資料就不放：迴圈結束時的 invalidate 會補上完整的清單。
          queryClient.setQueryData<PhotoResponse[]>(photoKeys.byRoll(item.rollId), (old) =>
            old ? insertByFrame(old, photo) : old,
          )
        } catch (error) {
          if (unmountRef.current.signal.aborted) return // 頁面已經離開，不用再更新畫面
          patch(item.key, {
            status: 'failed',
            // 逾時是 TimeoutError（DOMException），toUserMessage 認不得，自己給一句。
            // 取消上傳只是瀏覽器不等了，檔案可能已經整個送到、後端照樣存好；
            // 直接重試會變成第 409（同一格）或多一張重複的照片，所以請使用者先看一下印樣
            error:
              error instanceof DOMException && error.name === 'TimeoutError'
                ? '上傳逾時。伺服器可能已經收到，請先看印樣上有沒有這一格再重試'
                : toUserMessage(error),
            retryable: !(error instanceof ApiError) || error.status >= 500,
          })
        } finally {
          activeKeysRef.current.delete(item.key)
        }
      }
    } finally {
      runningRef.current = false
      // 一批跑完再跟後端對一次帳：上傳途中若有別的重抓（例如切回視窗觸發的）先回來、
      // 蓋掉了上面 setQueryData 放進去的照片，這裡會補回來。一批只多一次 GET。
      for (const id of touchedRolls) {
        void queryClient.invalidateQueries({ queryKey: photoKeys.byRoll(id) })
      }
    }
  }

  function enqueue(files: Iterable<File>) {
    const added: UploadItem[] = []
    for (const file of files) {
      const reason = rejectReason(file)
      added.push({
        key: nextKeyRef.current++,
        file,
        rollId,
        status: reason ? 'failed' : 'queued',
        error: reason ?? undefined,
        retryable: false,
      })
    }
    // 依檔名排序：沖印店的檔名帶格號，照順序傳，印樣就會一格一格依序長出來
    added.sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true }))
    setItems((prev) => [...prev, ...added])
    for (const item of added) {
      if (item.status !== 'queued') continue
      activeKeysRef.current.add(item.key)
      pendingRef.current.push(item)
    }
    void drain()
  }

  function retry(key: number) {
    const item = items.find((candidate) => candidate.key === key)
    if (!item || item.status !== 'failed' || !item.retryable) return
    // 同一次 render 裡連點兩下，兩次看到的 items 都還是 failed；已經在排隊或在傳就不再排
    if (activeKeysRef.current.has(key)) return
    activeKeysRef.current.add(key)
    patch(key, { status: 'queued', error: undefined })
    pendingRef.current.push(item)
    void drain()
  }

  function clearFinished() {
    setItems((prev) => prev.filter((item) => item.status !== 'done'))
  }

  const isBusy = items.some((item) => item.status === 'queued' || item.status === 'uploading')

  return { items, enqueue, retry, clearFinished, isBusy }
}
