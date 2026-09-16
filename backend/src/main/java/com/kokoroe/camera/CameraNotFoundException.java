package com.kokoroe.camera;

/** 查無指定相機，轉為 404。 */
public class CameraNotFoundException extends RuntimeException {

    public CameraNotFoundException(Long id) {
        super("找不到 id 為 %d 的相機".formatted(id));
    }
}
