package com.kokoroe.photo;

import java.util.Locale;

/**
 * 每張照片在儲存空間裡的三個版本。
 *
 * <ul>
 *   <li>{@code THUMB}：長邊 {@value ImageProcessor#THUMB_EDGE} px，印樣格狀檢視用，一頁幾十張也很快。</li>
 *   <li>{@code WEB}：長邊 {@value ImageProcessor#WEB_EDGE} px，點開放大（lightbox）用。</li>
 *   <li>{@code ORIGINAL}：使用者上傳的原檔，一個 byte 都不改，下載與日後重新產生版本用。</li>
 * </ul>
 *
 * <p>網址與儲存空間的檔名都用小寫的常數名（{@code /photos/7/thumb}、{@code thumb.jpg}）。
 */
public enum PhotoVariant {

    THUMB,
    WEB,
    ORIGINAL;

    /** 物件在儲存空間裡的檔名，接在照片的 storage key 後面。 */
    public String fileName() {
        return name().toLowerCase(Locale.ROOT) + ".jpg";
    }

    /**
     * @throws IllegalArgumentException 不是三個版本之一
     */
    public static PhotoVariant fromPathSegment(String segment) {
        // Locale.ROOT：避免在土耳其語系把 "i" 轉成 "İ" 這類語系相關的意外
        return valueOf(segment.toUpperCase(Locale.ROOT));
    }
}
