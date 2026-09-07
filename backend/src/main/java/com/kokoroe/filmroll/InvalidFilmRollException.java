package com.kokoroe.filmroll;

/**
 * 資料本身合法（通過了 Bean Validation），但違反跨欄位的商業規則。
 * 例如：拍完日期早於裝片日期。轉為 400 Bad Request。
 */
public class InvalidFilmRollException extends RuntimeException {

    public InvalidFilmRollException(String message) {
        super(message);
    }
}
