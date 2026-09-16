package com.kokoroe.camera.dto;

import com.kokoroe.camera.CameraFormat;
import com.kokoroe.camera.CameraType;
import com.kokoroe.camera.FilmAdvance;
import com.kokoroe.camera.FocusType;

import java.time.Instant;

/**
 * 對外回傳的相機。
 *
 * @param name 顯示用名稱（「品牌 型號」），前端不必自己拼。
 */
public record CameraResponse(
        Long id,
        String brand,
        String model,
        String name,
        CameraFormat format,
        CameraType cameraType,
        FocusType focusType,
        FilmAdvance filmAdvance,
        Boolean hasFlash,
        Boolean interchangeableLens,
        String fixedLens,
        String shutterSpeedRange,
        Integer isoMin,
        Integer isoMax,
        String notes,
        Instant createdAt,
        Instant updatedAt
) {
}
