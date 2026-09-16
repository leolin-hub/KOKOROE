package com.kokoroe.camera;

/**
 * 相機資料違反跨欄位規則，轉為 400。
 * 例如：可換鏡頭的機身卻填了定焦鏡頭、ISO 下限大於上限。
 */
public class InvalidCameraException extends RuntimeException {

    public InvalidCameraException(String message) {
        super(message);
    }
}
