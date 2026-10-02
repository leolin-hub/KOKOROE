package com.kokoroe.photo;

/**
 * 這一格已經有照片，轉為 409。
 *
 * <p>不自動覆蓋：重掃或傳錯檔時，悄悄蓋掉舊照片比擋下來更難發現。要換就先刪掉舊的。
 */
public class DuplicateFrameException extends RuntimeException {

    public DuplicateFrameException(int frameNumber) {
        super("第 %d 格已經有照片，要換的話請先刪除原本那張".formatted(frameNumber));
    }
}
