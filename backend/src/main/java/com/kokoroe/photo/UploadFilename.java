package com.kokoroe.photo;

import java.util.Optional;
import java.util.OptionalInt;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 從上傳檔名推出「要存的顯示名稱」與「格號」。
 *
 * <p>沖印店的掃描檔通常是 {@code 000123_01.jpg}、{@code R1-00001-0012.JPG} 這種格式，
 * 最後一組數字就是格號。
 */
public final class UploadFilename {

    static final int MAX_LENGTH = 255;

    /** 最後一組數字：後面不能再出現任何數字。 */
    private static final Pattern LAST_DIGITS = Pattern.compile("(\\d+)\\D*$");

    /**
     * 換行、tab 等控制字元，以及看不見的 Unicode 格式字元（例如 U+202E 從右到左覆寫，
     * 能讓 {@code fdp.gpj} 在畫面上顯示成別的檔名）：寫進 log 或顯示在畫面上都會出問題，直接拿掉。
     * {@code \p{C}} 涵蓋控制、格式、未指派等類別；{@code \p{Zl}} / {@code \p{Zp}} 是 Unicode 的換行與分段。
     */
    private static final Pattern CONTROL_CHARS = Pattern.compile("[\\p{C}\\p{Zl}\\p{Zp}]");

    private UploadFilename() {
        throw new AssertionError("工具類別不應被實例化");
    }

    /**
     * 只留檔名本身，去掉路徑（舊版 IE 會送整條 {@code C:\Users\...}）與控制字元，並截到欄位長度。
     *
     * @return 沒有檔名或清完是空字串時為 empty
     */
    public static Optional<String> displayName(String original) {
        if (original == null) {
            return Optional.empty();
        }
        String name = original.substring(Math.max(original.lastIndexOf('/'), original.lastIndexOf('\\')) + 1);
        name = CONTROL_CHARS.matcher(name).replaceAll("").strip();
        if (name.isEmpty()) {
            return Optional.empty();
        }
        // 以字元（code point）而不是 char 截斷：emoji 等字元佔兩個 char，從中間切會產生壞掉的字串
        if (name.codePointCount(0, name.length()) > MAX_LENGTH) {
            name = name.substring(0, name.offsetByCodePoints(0, MAX_LENGTH));
        }
        return Optional.of(name);
    }

    /**
     * 取副檔名之前的最後一組數字當格號。
     *
     * <p>超出 0–99 的數字不算（例如相機流水號 {@code IMG_4521}），交給呼叫端改用下一個空格號。
     */
    public static OptionalInt frameNumber(String displayName) {
        int dot = displayName.lastIndexOf('.');
        String stem = dot > 0 ? displayName.substring(0, dot) : displayName;
        Matcher matcher = LAST_DIGITS.matcher(stem);
        if (!matcher.find()) {
            return OptionalInt.empty();
        }
        String digits = matcher.group(1).replaceFirst("^0+(?=\\d)", "");
        // 去掉前導零後超過兩位數就一定 > 99，不用 parse（也避免超長數字溢位）
        if (digits.length() > 2) {
            return OptionalInt.empty();
        }
        return OptionalInt.of(Integer.parseInt(digits));
    }
}
