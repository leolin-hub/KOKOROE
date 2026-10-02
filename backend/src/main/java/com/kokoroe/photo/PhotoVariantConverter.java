package com.kokoroe.photo;

import org.springframework.core.convert.converter.Converter;
import org.springframework.stereotype.Component;

/**
 * 讓 {@code @PathVariable PhotoVariant} 吃小寫的 {@code thumb} / {@code web} / {@code original}
 * （Spring 內建的 enum 轉換只認大小寫完全相同的常數名）。
 *
 * <p>Spring Boot 會自動把 {@link Converter} bean 註冊到 MVC。轉換失敗時 Spring 包成
 * {@code MethodArgumentTypeMismatchException}，由 {@code GlobalExceptionHandler} 回 400。
 */
@Component
public class PhotoVariantConverter implements Converter<String, PhotoVariant> {

    @Override
    public PhotoVariant convert(String source) {
        return PhotoVariant.fromPathSegment(source);
    }
}
