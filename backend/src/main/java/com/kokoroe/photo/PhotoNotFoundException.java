package com.kokoroe.photo;

/** 查無指定照片，轉為 404。 */
public class PhotoNotFoundException extends RuntimeException {

    public PhotoNotFoundException(Long id) {
        super("找不到 id 為 %d 的照片".formatted(id));
    }
}
