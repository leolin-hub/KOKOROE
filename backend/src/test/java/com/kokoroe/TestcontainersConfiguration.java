package com.kokoroe;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * 測試用的 PostgreSQL 容器。
 *
 * <p>版本刻意釘死在 {@code 16-alpine}，與 docker-compose.yml 完全一致。
 * Initializr 預設產生的是 {@code postgres:latest} —— 那會讓測試結果隨著上游發版而漂移，
 * 也可能在本機通過卻在 CI 失敗（兩邊抓到的 latest 不同）。測試必須是可重現的。
 *
 * <p>{@code @ServiceConnection} 會自動把容器的連線資訊注入 Spring context，
 * 不需要再手寫 {@code @DynamicPropertySource}。
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgresContainer() {
        return new PostgreSQLContainer(DockerImageName.parse("postgres:16-alpine"));
    }
}
