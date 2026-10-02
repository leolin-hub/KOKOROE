package com.kokoroe.photo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

/**
 * 卷期裡的一張照片（一格）。
 *
 * <p>用 {@code filmRollId} 數字指向卷期，而不是 {@code @ManyToOne FilmRoll}：
 * 照片從來不需要載入卷期的內容，存 id 就夠了，也避免 LAZY 關聯在交易外被碰到時出錯。
 * 外鍵約束仍然在資料庫裡（見 V4 migration）。
 *
 * <p>照片上傳後內容不會再改，所以只有 {@code createdAt}，沒有 {@code updatedAt}，也沒有變更方法。
 * Lombok 的取捨與 {@code FilmRoll} 相同：不用 {@code @Data}。
 */
@Entity
@Table(name = "photo")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Builder(access = AccessLevel.PRIVATE)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Photo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "film_roll_id", nullable = false, updatable = false)
    private Long filmRollId;

    @Column(name = "frame_number", nullable = false, updatable = false)
    private Integer frameNumber;

    /** 儲存空間裡的前綴，例如 {@code rolls/7/3f2c…}，底下放三個版本。 */
    @Column(name = "storage_key", nullable = false, updatable = false, length = 100)
    private String storageKey;

    /** 上傳時的檔名，只用來顯示，已去掉路徑。 */
    @Column(name = "original_filename", updatable = false)
    private String originalFilename;

    /** 依 EXIF 轉正之後的原圖寬度。 */
    @Column(name = "width", nullable = false, updatable = false)
    private Integer width;

    @Column(name = "height", nullable = false, updatable = false)
    private Integer height;

    /** 原檔大小（byte）。 */
    @Column(name = "size_bytes", nullable = false, updatable = false)
    private Long sizeBytes;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public static Photo create(Long filmRollId, int frameNumber, String storageKey,
                               String originalFilename, int width, int height, long sizeBytes) {
        return Photo.builder()
                .filmRollId(filmRollId)
                .frameNumber(frameNumber)
                .storageKey(storageKey)
                .originalFilename(originalFilename)
                .width(width)
                .height(height)
                .sizeBytes(sizeBytes)
                .build();
    }

    public String objectKey(PhotoVariant variant) {
        return objectKey(storageKey, variant);
    }

    /** 這張照片在儲存空間裡的全部物件，刪除時用。 */
    public static List<String> allObjectKeys(String storageKey) {
        return Arrays.stream(PhotoVariant.values())
                .map(variant -> objectKey(storageKey, variant))
                .toList();
    }

    private static String objectKey(String storageKey, PhotoVariant variant) {
        return storageKey + "/" + variant.fileName();
    }
}
