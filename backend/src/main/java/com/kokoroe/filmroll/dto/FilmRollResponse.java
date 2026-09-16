package com.kokoroe.filmroll.dto;

import com.kokoroe.camera.dto.CameraSummaryResponse;
import com.kokoroe.filmroll.FilmFormat;
import com.kokoroe.filmroll.FilmRollStatus;

import java.time.Instant;
import java.time.LocalDate;

/**
 * 對外回傳的卷期表示。
 *
 * <p>這就是前端 TypeScript interface 要嚴格對齊的那份契約。
 * {@code @Entity} 永遠不會出現在 Controller 簽章裡 —— 否則資料庫欄位的任何調整
 * 都會不受控地變成破壞性的 API 變更，且極易誤將內部欄位洩漏出去。
 */
public record FilmRollResponse(
        Long id,
        String filmName,
        String brand,
        Integer iso,
        FilmFormat format,
        Integer pushPullStops,
        LocalDate loadedAt,
        LocalDate finishedAt,
        CameraSummaryResponse camera,
        String lensName,
        String notes,
        FilmRollStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
