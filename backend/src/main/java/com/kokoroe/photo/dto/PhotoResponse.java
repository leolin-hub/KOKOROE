package com.kokoroe.photo.dto;

import java.time.Instant;

/**
 * 對外回傳的照片中繼資料。
 *
 * <p>不含圖檔網址：前端用 {@code id} 自己組 {@code /api/v1/photos/{id}/thumb} 等路徑，
 * 和其他 API 一樣受 {@code VITE_API_BASE_URL} 控制。
 * 也不含 {@code storageKey}：儲存空間的配置是內部細節。
 *
 * @param width  依 EXIF 轉正後的原圖寬度，前端用來算長寬比
 * @param height 同上
 */
public record PhotoResponse(
        Long id,
        Long filmRollId,
        Integer frameNumber,
        String originalFilename,
        Integer width,
        Integer height,
        Long sizeBytes,
        Instant createdAt
) {
}
