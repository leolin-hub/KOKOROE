package com.kokoroe.photo;

/** 上傳的檔案不能當照片收下（不是 JPEG、讀不出來、太大、格號不合法），轉為 400。 */
public class InvalidPhotoException extends RuntimeException {

    public InvalidPhotoException(String message) {
        super(message);
    }
}
