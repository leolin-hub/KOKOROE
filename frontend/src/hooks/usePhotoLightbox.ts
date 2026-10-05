import { useDeletePhoto } from './usePhotoMutations'
import type { PhotoResponse } from '../types/photo'

interface UsePhotoLightboxOptions {
  rollId: number
  /** 這一卷的照片（依格號排序）；還沒載入時傳空陣列 */
  photos: readonly PhotoResponse[]
  /** 目前開著哪一張（照片 id）；null 代表關閉 */
  openId: number | null
  /** 換張或關閉時呼叫。開著哪一張存在哪裡（網址或 state）由呼叫端決定 */
  onOpenChange: (photoId: number | null) => void
}

/**
 * `PhotoLightbox` 需要的全部 props：上下張、關閉、刪除後跳到隔壁那張。
 *
 * 印樣頁和底片盒都會打開同一個 lightbox，差別只在「開著哪一張」存在哪裡：
 * 印樣頁放網址（?photo=12，可以分享、重新整理還在），底片盒放 state（攤開的底片條是暫時的）。
 * 所以這支 hook 不管存放，只透過 `openId` / `onOpenChange` 讀寫，其餘邏輯兩邊共用。
 */
export function usePhotoLightbox({ rollId, photos, openId, onOpenChange }: UsePhotoLightboxOptions) {
  const deleteMutation = useDeletePhoto()
  const found = photos.findIndex((photo) => photo.id === openId)
  // 指到不存在的照片（被刪了、網址亂打）就當作沒打開
  const index = found >= 0 ? found : null

  function show(photo: PhotoResponse | null) {
    // 換張就清掉上一張的刪除錯誤。刪除還在進行時不清：清了「刪除中…」會消失，按鈕又能再按一次
    if (!deleteMutation.isPending) deleteMutation.reset()
    onOpenChange(photo?.id ?? null)
  }

  function handleDelete(photo: PhotoResponse) {
    if (!window.confirm(`確定要刪除第 ${photo.frameNumber} 格嗎？原檔也會一起刪除，無法復原。`)) return
    // 刪掉之後停在下一張；刪的是最後一張就往前一張；全刪光就關掉
    const at = photos.findIndex((candidate) => candidate.id === photo.id)
    const neighbor = photos[at + 1] ?? photos[at - 1] ?? null
    deleteMutation.mutate({ photoId: photo.id, rollId }, { onSuccess: () => show(neighbor) })
  }

  return {
    /** 給 ContactSheet、底片條：點某一格時打開 */
    open: (photo: PhotoResponse) => show(photo),
    /** 直接展開到 `<PhotoLightbox {...lightbox.props} />` */
    props: {
      photos,
      index,
      onNavigate: (next: number) => show(photos[next] ?? null),
      onClose: () => show(null),
      onDelete: handleDelete,
      isDeleting: deleteMutation.isPending,
      deleteError: deleteMutation.error,
    },
  }
}
