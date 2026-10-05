import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { deletePhoto } from '../api/photos'
import { photoKeys } from './queryKeys'
import type { PhotoResponse } from '../types/photo'

/** `useDeletePhoto` 的 `mutate()` 參數。要 rollId 才知道該更新哪一卷的快取。 */
export interface DeletePhotoVariables {
  photoId: number
  rollId: number
}

/**
 * 刪除一張照片。
 *
 * 成功後直接從快取拿掉那一張（setQueryData），而不是 invalidate 重抓：
 * 刪掉哪一張是確定的事，不必再問後端一次，印樣上那一格也會立刻消失。
 */
export function useDeletePhoto(): UseMutationResult<void, Error, DeletePhotoVariables> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ photoId }: DeletePhotoVariables) => deletePhoto(photoId),
    onSuccess: (_data, { photoId, rollId }) => {
      queryClient.setQueryData<PhotoResponse[]>(photoKeys.byRoll(rollId), (old) =>
        old?.filter((photo) => photo.id !== photoId),
      )
    },
    // 成功或失敗都再跟後端對一次帳：刪除途中若有重抓先回來（裡面還有這張），會蓋掉上面的結果。
    // 刻意不 return 這個 promise：return 的話 TanStack 會等重抓完成，呼叫端 mutate(..., { onSuccess })
    // 也要等一趟網路才執行 —— 放大檢視會先因為照片從快取消失而關掉，等重抓完才跳到下一張再打開。
    onSettled: (_data, _error, { rollId }) => {
      void queryClient.invalidateQueries({ queryKey: photoKeys.byRoll(rollId) })
    },
  })
}
