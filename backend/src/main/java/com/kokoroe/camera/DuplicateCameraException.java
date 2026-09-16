package com.kokoroe.camera;

/**
 * 已經有同品牌、同型號的相機（不分大小寫），轉為 409。
 *
 * <p>資料庫的 {@code uq_camera_brand_model} 也會擋，但 Service 先查一次，
 * 才能回一句使用者看得懂的訊息，而不是籠統的「資料衝突」。
 */
public class DuplicateCameraException extends RuntimeException {

    public DuplicateCameraException(String displayName) {
        super("已經有名為「%s」的相機".formatted(displayName));
    }
}
