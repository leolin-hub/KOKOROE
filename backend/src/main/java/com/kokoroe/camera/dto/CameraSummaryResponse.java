package com.kokoroe.camera.dto;

/**
 * 嵌在卷期回應裡的相機摘要。
 *
 * <p>卷期只需要「是哪台相機」，完整規格要看時再打 {@code GET /api/v1/cameras/{id}}。
 * 不把整份 {@link CameraResponse} 塞進每一卷，列表頁的回應才不會跟著相機欄位變肥。
 */
public record CameraSummaryResponse(
        Long id,
        String name
) {
}
