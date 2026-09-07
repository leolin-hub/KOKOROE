package com.kokoroe.filmroll;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Arrays;

/**
 * 底片規格。
 *
 * <p>Java 識別字不能以數字開頭，所以常數名稱是 {@code FORMAT_135}，
 * 但對外的 JSON 契約是攝影圈慣用的 {@code "135"} / {@code "120"}。
 * 這層轉換靠 {@link JsonValue} / {@link JsonCreator} 完成，
 * 讓內部命名限制不外洩到 API 契約。
 */
public enum FilmFormat {

    FORMAT_135("135"),
    FORMAT_120("120");

    private final String code;

    FilmFormat(String code) {
        this.code = code;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    /**
     * 同時接受對外代碼（{@code "135"}）與常數名稱（{@code "FORMAT_135"}），
     * 前者是正式契約，後者讓手動測試與既有資料匯入更寬容。
     */
    @JsonCreator
    public static FilmFormat fromCode(String value) {
        if (value == null) {
            return null;
        }
        return Arrays.stream(values())
                .filter(f -> f.code.equalsIgnoreCase(value) || f.name().equalsIgnoreCase(value))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "不支援的底片規格：'%s'（可用值：135、120）".formatted(value)));
    }
}
