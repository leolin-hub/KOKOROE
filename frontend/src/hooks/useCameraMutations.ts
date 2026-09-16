import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { createCamera, deleteCamera, updateCamera } from '../api/cameras'
import { cameraKeys, filmRollKeys } from './queryKeys'
import type { CameraResponse, CreateCameraRequest, UpdateCameraRequest } from '../types/camera'

/**
 * 相機的寫入操作。骨架與 `useFilmRollMutations` 相同，差別在要失效的快取：
 *
 *   新增 → 相機列表（表單的下拉選單、相機頁）
 *   更新 → 相機列表、這台相機，**還有所有卷期**
 *   刪除 → 相機列表，並移除這台相機的快取
 *
 * 更新要連卷期一起失效：卷期的回應裡嵌著相機名稱（`camera: { id, name }`），
 * 改了品牌或型號，列表卡片與詳情頁顯示的名稱也要跟著變。
 * 刪除不用：後端不允許刪除還有卷期在用的相機，所以不會有卷期指向被刪的相機。
 */

export function useCreateCamera(): UseMutationResult<CameraResponse, Error, CreateCameraRequest> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCamera,
    onSuccess: (created) => {
      queryClient.setQueryData(cameraKeys.detail(created.id), created)
      return queryClient.invalidateQueries({ queryKey: cameraKeys.lists() })
    },
  })
}

export interface UpdateCameraVariables {
  id: number
  body: UpdateCameraRequest
}

export function useUpdateCamera(): UseMutationResult<CameraResponse, Error, UpdateCameraVariables> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: UpdateCameraVariables) => updateCamera(id, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(cameraKeys.detail(updated.id), updated)
      queryClient.invalidateQueries({ queryKey: cameraKeys.lists() })
      queryClient.invalidateQueries({ queryKey: filmRollKeys.all })
    },
  })
}

export function useDeleteCamera(): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteCamera,
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: cameraKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: cameraKeys.lists() })
    },
  })
}
