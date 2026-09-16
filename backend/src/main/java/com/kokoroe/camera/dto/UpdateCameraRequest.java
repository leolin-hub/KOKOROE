package com.kokoroe.camera.dto;

import com.kokoroe.camera.CameraFormat;
import com.kokoroe.camera.CameraType;
import com.kokoroe.camera.FilmAdvance;
import com.kokoroe.camera.FocusType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * 更新相機的請求（PUT 語意：整份取代，沒送的規格會被清成 null）。
 *
 * <p>目前欄位與 {@link CreateCameraRequest} 完全相同，仍刻意分開，理由同 {@code UpdateFilmRollRequest}。
 */
public record UpdateCameraRequest(

        @Size(max = 50, message = "品牌長度不可超過 50 字")
        String brand,

        @NotBlank(message = "型號不可為空")
        @Size(max = 100, message = "型號長度不可超過 100 字")
        String model,

        @NotNull(message = "片幅為必填（135、120 或 half-frame）")
        CameraFormat format,

        CameraType cameraType,

        FocusType focusType,

        FilmAdvance filmAdvance,

        Boolean hasFlash,

        Boolean interchangeableLens,

        @Size(max = 100, message = "定焦鏡頭長度不可超過 100 字")
        String fixedLens,

        @Size(max = 50, message = "快門速度範圍長度不可超過 50 字")
        String shutterSpeedRange,

        @Positive(message = "ISO 下限必須為正整數")
        @Max(value = 12800, message = "ISO 下限不可超過 12800")
        Integer isoMin,

        @Positive(message = "ISO 上限必須為正整數")
        @Max(value = 12800, message = "ISO 上限不可超過 12800")
        Integer isoMax,

        @Size(max = 2000, message = "備註長度不可超過 2000 字")
        String notes
) {
}
