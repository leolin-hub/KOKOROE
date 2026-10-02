package com.kokoroe;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.DynamicPropertyRegistrar;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * 測試用的 PostgreSQL 與 RustFS 容器。
 *
 * <p>版本刻意釘死，與 docker-compose.yml 完全一致。
 * Initializr 預設產生的是 {@code postgres:latest} —— 那會讓測試結果隨著上游發版而漂移，
 * 也可能在本機通過卻在 CI 失敗（兩邊抓到的 latest 不同）。測試必須是可重現的。
 *
 * <p>{@code @ServiceConnection} 會自動把容器的連線資訊注入 Spring context，
 * 不需要再手寫 {@code @DynamicPropertySource}。
 * RustFS 沒有內建的 service connection，改用 {@link DynamicPropertyRegistrar} bean 把位址填進
 * {@code kokoroe.storage.*}；bucket 由 {@code StorageConfig} 啟動時自動建立。
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    private static final String STORAGE_ACCESS_KEY = "test-access";
    private static final String STORAGE_SECRET_KEY = "test-secret-key";
    private static final int S3_PORT = 9000;

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgresContainer() {
        return new PostgreSQLContainer(DockerImageName.parse("postgres:16-alpine"));
    }

    @Bean
    GenericContainer<?> rustfsContainer() {
        return new GenericContainer<>(DockerImageName.parse("rustfs/rustfs:1.0.0"))
                .withEnv("RUSTFS_ACCESS_KEY", STORAGE_ACCESS_KEY)
                .withEnv("RUSTFS_SECRET_KEY", STORAGE_SECRET_KEY)
                .withExposedPorts(S3_PORT)
                .waitingFor(Wait.forHttp("/health").forPort(S3_PORT).forStatusCode(200));
    }

    @Bean
    DynamicPropertyRegistrar storageProperties(GenericContainer<?> rustfsContainer) {
        return registry -> {
            registry.add("kokoroe.storage.endpoint", () -> "http://%s:%d".formatted(
                    rustfsContainer.getHost(), rustfsContainer.getMappedPort(S3_PORT)));
            registry.add("kokoroe.storage.access-key", () -> STORAGE_ACCESS_KEY);
            registry.add("kokoroe.storage.secret-key", () -> STORAGE_SECRET_KEY);
            registry.add("kokoroe.storage.create-bucket", () -> "true");
        };
    }
}
