package com.kokoroe.storage;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.net.URI;

/**
 * 物件儲存連線設定，對應 {@code application.yml} 的 {@code kokoroe.storage.*}。
 *
 * <p>本機開發連 docker compose 的 RustFS，正式環境連 Cloudflare R2，兩者都是 S3 API，
 * 只有這幾個值不同，程式碼完全一樣。
 *
 * <p>加上 {@code @Validated}：值是空白時讓應用程式在啟動當下就失敗，
 * 而不是等到第一次上傳照片才冒出難懂的 SDK 錯誤。
 * 注意它擋不住「忘了設」：{@code application.yml} 每個值都有本機預設，
 * 正式環境漏設 {@code STORAGE_ENDPOINT} 會照樣啟動、連向 localhost。部署設定要逐一確認。
 *
 * @param endpoint           S3 API 位址，例如 {@code http://localhost:9000}、
 *                           {@code https://<account>.r2.cloudflarestorage.com}
 * @param region             R2 用 {@code auto}；RustFS 不檢查，填 {@code us-east-1} 即可
 * @param createBucket       啟動時若 bucket 不存在就建立。只在本機與測試開啟；
 *                           正式環境的 bucket 由人在 Cloudflare 後台建立，金鑰也只給物件讀寫權限
 */
@Validated
@ConfigurationProperties("kokoroe.storage")
public record StorageProperties(
        @NotNull URI endpoint,
        @NotBlank String region,
        @NotBlank String bucket,
        @NotBlank String accessKey,
        @NotBlank String secretKey,
        boolean createBucket
) {

    /** 不讓金鑰出現在 log 或例外訊息裡（record 預設的 toString 會印出全部欄位）。 */
    @Override
    public String toString() {
        return "StorageProperties[endpoint=%s, region=%s, bucket=%s, createBucket=%s]"
                .formatted(endpoint, region, bucket, createBucket);
    }
}
