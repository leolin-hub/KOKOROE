package com.kokoroe.camera;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.kokoroe.filmroll.FilmFormat;

import java.util.Arrays;

/**
 * 相機片幅。
 *
 * <p>和 {@link FilmFormat} 分開：底片只有 135 / 120 兩種，但相機多了半格機 ——
 * 半格機裝的是一般 135 底片，只是每格畫面切成一半。
 * 常數名稱刻意與 {@link FilmFormat} 對齊（{@code FORMAT_135}、{@code FORMAT_120}），
 * V2 migration 才能直接把卷期的 {@code format} 值搬成相機的片幅。
 */
public enum CameraFormat {

    FORMAT_135("135", FilmFormat.FORMAT_135),
    FORMAT_120("120", FilmFormat.FORMAT_120),
    HALF_FRAME("half-frame", FilmFormat.FORMAT_135);

    private final String code;
    private final FilmFormat filmFormat;

    CameraFormat(String code, FilmFormat filmFormat) {
        this.code = code;
        this.filmFormat = filmFormat;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    /** 這個片幅的相機裝的底片規格（半格機裝 135）。 */
    public FilmFormat getFilmFormat() {
        return filmFormat;
    }

    /** 這台相機能不能裝這個規格的底片。 */
    public boolean accepts(FilmFormat format) {
        return this.filmFormat == format;
    }

    /** 與 {@link FilmFormat#fromCode} 相同：同時接受對外代碼與常數名稱。 */
    @JsonCreator
    public static CameraFormat fromCode(String value) {
        if (value == null) {
            return null;
        }
        return Arrays.stream(values())
                .filter(f -> f.code.equalsIgnoreCase(value) || f.name().equalsIgnoreCase(value))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "不支援的相機片幅：'%s'（可用值：135、120、half-frame）".formatted(value)));
    }
}
