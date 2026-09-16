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
 * 新增卷期的請求。
 *
 * <p>用 {@code record} 而非 class：DTO 本質上是不可變的資料載體，
 * record 天生就是這個語意，也免掉一整組 getter/equals/hashCode 樣板。
 *
 * <p>註：{@code loadedAt} 刻意<b>不</b>加 {@code @PastOrPresent}。
 * 該約束以伺服器時區判定，若容器跑 UTC 而使用者在 UTC+8 輸入自己的「今天」，
 * 會被誤判為未來日期而擋下。時區正確性要在有明確使用者時區來源後再處理。
 */
public record CreateFilmRollRequest(

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

        /** 相機的 id（先用 {@code GET /api/v1/cameras} 取得），不指定相機時省略。 */
        Long cameraId,

        @Size(max = 100, message = "鏡頭名稱長度不可超過 100 字")
        String lensName,

        @Size(max = 2000, message = "備註長度不可超過 2000 字")
        String notes,

        FilmRollStatus status
) {
    /**
     * Compact constructor：在驗證之前先把可選欄位正規化。
     * 讓「沒填 = 預設值」的規則只寫一次，而不是在 Service 與 Mapper 各補一次 null 判斷。
     */
    public CreateFilmRollRequest {
        if (pushPullStops == null) {
            pushPullStops = 0;
        }
        if (status == null) {
            status = FilmRollStatus.LOADED;
        }
    }
}
