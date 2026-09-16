package com.kokoroe.camera;

/**
 * 還有卷期使用這台相機，不能刪除，轉為 409。
 *
 * <p>刻意不做連帶刪除，也不把卷期的相機清成 null：
 * 前者會默默刪掉拍攝紀錄，後者會讓紀錄悄悄少掉資訊。讓使用者自己決定怎麼處理。
 */
public class CameraInUseException extends RuntimeException {

    public CameraInUseException(Long id, long rollCount) {
        super("id 為 %d 的相機還有 %d 卷底片使用中，請先修改這些卷期的相機".formatted(id, rollCount));
    }
}
