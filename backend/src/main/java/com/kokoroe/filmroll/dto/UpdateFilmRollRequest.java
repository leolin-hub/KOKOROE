package com.kokoroe.filmroll.dto;

import com.kokoroe.filmroll.FilmFormat;
import com.kokoroe.filmroll.FilmRollStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * 更新卷期的請求（PUT 語意：整份取代）。
 *
 * <p>刻意與 {@link CreateFilmRollRequest} 分開而非共用同一個 DTO：
 * 兩者的必填規則未來會分歧（例如新增時不該讓人直接指定 ARCHIVED），
 * 共用會逼出一堆 validation group 的複雜度。這裡的少量重複是划算的。
 */
public record UpdateFilmRollRequest(

        @NotBlank(message = "底片名稱不可為空")
        @Size(max = 100, message = "底片名稱長度不可超過 100 字")
        String filmName,

        @Size(max = 50, message = "品牌長度不可超過 50 字")
        String brand,

        @NotNull(message = "ISO 感光度為必填")
        @Positive(message = "ISO 感光度必須為正整數")
        @Max(value = 12800, message = "ISO 感光度不可超過 12800")
        Integer iso,

        @NotNull(message = "底片規格為必填（135 或 120）")
        FilmFormat format,

        @Min(value = -3, message = "增減感格數範圍為 -3 至 +3")
        @Max(value = 3, message = "增減感格數範圍為 -3 至 +3")
        Integer pushPullStops,

        @NotNull(message = "裝片日期為必填")
        LocalDate loadedAt,

        LocalDate finishedAt,

        @Size(max = 100, message = "相機名稱長度不可超過 100 字")
        String cameraName,

        @Size(max = 100, message = "鏡頭名稱長度不可超過 100 字")
        String lensName,

        @Size(max = 2000, message = "備註長度不可超過 2000 字")
        String notes,

        @NotNull(message = "狀態為必填")
        FilmRollStatus status
) {
    public UpdateFilmRollRequest {
        if (pushPullStops == null) {
            pushPullStops = 0;
        }
    }
}
