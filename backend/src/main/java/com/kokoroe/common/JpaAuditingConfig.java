package com.kokoroe.common;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.auditing.DateTimeProvider;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

/**
 * 啟用 JPA Auditing，讓 {@code @CreatedDate} / {@code @LastModifiedDate} 自動填值。
 *
 * <p>刻意獨立成一個 config 類別而非掛在主 Application 上：
 * 掛在主類別會讓所有切片測試都被迫載入 auditing 基礎設施，分離後才是可選的。
 */
@Configuration
@EnableJpaAuditing(dateTimeProviderRef = "auditingDateTimeProvider")
public class JpaAuditingConfig {

    /**
     * 產生稽核時間戳，並<b>截斷到微秒</b>。
     *
     * <p>Java 的 {@link Instant} 是奈秒精度，而 PostgreSQL 的 {@code timestamp}
     * 只有微秒精度。若直接寫入 {@code Instant.now()}，資料庫會做四捨五入，
     * 造成「剛寫入的物件」與「重新查詢出來的物件」時間戳不相等 ——
     * 例如寫入 {@code ...919840600Z}，讀回來變成 {@code ...919841Z}。
     *
     * <p>這類差異在單元測試（用 H2 或純 mock）看不出來，只有跑真實資料庫的整合測試才會浮現，
     * 卻足以讓 ETag 比對、快取失效判斷、以時間戳做樂觀鎖等機制出現無法重現的錯誤。
     * 在來源端就對齊精度，比在每個使用端補救可靠得多。
     */
    @Bean
    public DateTimeProvider auditingDateTimeProvider() {
        return () -> Optional.of(Instant.now().truncatedTo(ChronoUnit.MICROS));
    }
}
