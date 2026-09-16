package com.kokoroe.camera;

/**
 * 相機還有卷期使用中，改成新的片幅會讓這些卷期的底片規格不相容，轉為 409。
 *
 * <p>不擋的話，這些卷期之後每次更新（包括推進狀態）都會被 {@code FilmRoll} 的相容規則拒絕，
 * 使用者卻看不出問題出在相機。135 改成半格這種不影響底片規格的修改則照常允許。
 */
public class CameraFormatConflictException extends RuntimeException {

    public CameraFormatConflictException(String displayName, CameraFormat newFormat, long rollCount) {
        super("相機「%s」還有 %d 卷底片不是 %s 規格，不能改成 %s 片幅".formatted(
                displayName, rollCount, newFormat.getFilmFormat().getCode(), newFormat.getCode()));
    }
}
