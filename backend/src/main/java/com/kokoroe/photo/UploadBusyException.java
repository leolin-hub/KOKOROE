package com.kokoroe.photo;

/** 同時處理中的上傳已達上限，等太久仍輪不到，轉為 503。 */
public class UploadBusyException extends RuntimeException {

    public UploadBusyException() {
        super("目前有其他照片正在處理，請稍後再試");
    }
}
