package com.kokoroe.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;

/**
 * 建立 S3 client 與 {@link ObjectStorage} bean。
 */
@Configuration
@EnableConfigurationProperties(StorageProperties.class)
public class StorageConfig {

    private static final Logger log = LoggerFactory.getLogger(StorageConfig.class);

    /**
     * Spring 關閉時會自動呼叫 {@code S3Client.close()}，釋放連線池。
     *
     * <ul>
     *   <li>{@code forcePathStyle}：網址用 {@code endpoint/bucket/key}，而不是 {@code bucket.endpoint/key}。
     *       {@code localhost} 沒辦法加子網域，RustFS 只能用這種；R2 兩種都支援。</li>
     *   <li>checksum 設成 {@code WHEN_REQUIRED}：AWS SDK 新版預設每次上傳都附加 CRC 校驗標頭，
     *       部分 S3 相容服務不認得而拒絕請求。只在 API 規定必須時才附加。</li>
     * </ul>
     */
    @Bean
    S3Client s3Client(StorageProperties properties) {
        return S3Client.builder()
                .endpointOverride(properties.endpoint())
                .region(Region.of(properties.region()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(properties.accessKey(), properties.secretKey())))
                .forcePathStyle(true)
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .build();
    }

    @Bean
    ObjectStorage objectStorage(S3Client s3Client, StorageProperties properties) {
        return new S3ObjectStorage(s3Client, properties.bucket());
    }

    /**
     * 本機與測試：啟動時確保 bucket 存在，省去手動建立的步驟。
     * 正式環境 {@code create-bucket=false}，這裡什麼都不做。
     */
    @Bean
    ApplicationRunner storageBucketInitializer(S3Client s3Client, StorageProperties properties) {
        return args -> {
            if (!properties.createBucket()) {
                return;
            }
            String bucket = properties.bucket();
            try {
                s3Client.headBucket(request -> request.bucket(bucket));
            } catch (NoSuchBucketException ex) {
                s3Client.createBucket(request -> request.bucket(bucket));
                log.info("已建立 bucket {}", bucket);
            }
        };
    }
}
