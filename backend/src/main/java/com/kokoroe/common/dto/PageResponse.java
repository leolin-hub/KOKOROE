package com.kokoroe.common.dto;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/**
 * 分頁回應的對外契約。
 *
 * <p>刻意不直接序列化 Spring Data 的 {@code PageImpl}：它的 JSON 結構是實作細節，
 * 沒有穩定性保證（Spring Data 也明確不建議這麼做），前端一旦依賴就會在升級時被咬。
 * 自己定義一個扁平、命名清楚的 record，契約才握在自己手上。
 *
 * @param <T> 內容型別
 */
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean first,
        boolean last
) {
    /** 由 Spring Data 的 {@link Page} 轉換，並同時把實體映射成回應 DTO。 */
    public static <E, T> PageResponse<T> from(Page<E> page, Function<E, T> mapper) {
        return new PageResponse<>(
                page.getContent().stream().map(mapper).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.isFirst(),
                page.isLast()
        );
    }
}
