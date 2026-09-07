package com.kokoroe.filmroll;

/**
 * 查無指定卷期。由 Service 拋出，於 GlobalExceptionHandler 轉為 404。
 *
 * <p>刻意讓 Service 直接拋例外，而不是把 {@code Optional} 回傳給 Controller 自己判斷 ——
 * 否則「找不到要回什麼狀態碼」的決策會散落在每個 endpoint。
 */
public class FilmRollNotFoundException extends RuntimeException {

    public FilmRollNotFoundException(Long id) {
        super("找不到 id 為 %d 的底片卷期".formatted(id));
    }
}
