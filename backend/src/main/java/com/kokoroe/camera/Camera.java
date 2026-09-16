package com.kokoroe.camera;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;

/**
 * 底片相機。
 *
 * <p>Lombok 與「不提供 setter」的取捨同 {@code FilmRoll}。
 *
 * <p>規格欄位（{@link #cameraType} 之後的欄位）全部可為 null，代表「還不知道」。
 * 布林欄位因此用 {@link Boolean} 而不是 {@code boolean}：
 * 「沒有閃光燈」和「不確定有沒有閃光燈」是兩回事。
 */
@Entity
@Table(name = "camera")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Camera {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "brand", length = 50)
    private String brand;

    @Column(name = "model", nullable = false, length = 100)
    private String model;

    @Enumerated(EnumType.STRING)
    @Column(name = "format", nullable = false, length = 16)
    private CameraFormat format;

    @Enumerated(EnumType.STRING)
    @Column(name = "camera_type", length = 20)
    private CameraType cameraType;

    @Enumerated(EnumType.STRING)
    @Column(name = "focus_type", length = 16)
    private FocusType focusType;

    @Enumerated(EnumType.STRING)
    @Column(name = "film_advance", length = 16)
    private FilmAdvance filmAdvance;

    @Column(name = "has_flash")
    private Boolean hasFlash;

    @Column(name = "interchangeable_lens")
    private Boolean interchangeableLens;

    /** 不可換鏡頭的相機所內建的鏡頭，例如 {@code 35mm f/4.5}。 */
    @Column(name = "fixed_lens", length = 100)
    private String fixedLens;

    /** 快門速度範圍，自由文字，例如 {@code 1/60–1/250}。 */
    @Column(name = "shutter_speed_range", length = 50)
    private String shutterSpeedRange;

    /** 可設定（或 DX 可讀取）的 ISO 範圍。 */
    @Column(name = "iso_min")
    private Integer isoMin;

    @Column(name = "iso_max")
    private Integer isoMax;

    @Column(name = "notes", columnDefinition = "text")
    private String notes;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    // ---------------------------------------------------------------------
    // 工廠方法與變更行為
    // ---------------------------------------------------------------------

    public static Camera create(String brand, String model, CameraFormat format,
                                CameraType cameraType, FocusType focusType, FilmAdvance filmAdvance,
                                Boolean hasFlash, Boolean interchangeableLens, String fixedLens,
                                String shutterSpeedRange, Integer isoMin, Integer isoMax, String notes) {
        requireValidSpecs(interchangeableLens, fixedLens, isoMin, isoMax);
        return Camera.builder()
                .brand(normalizeName(brand))
                .model(normalizeName(model))
                .format(format)
                .cameraType(cameraType)
                .focusType(focusType)
                .filmAdvance(filmAdvance)
                .hasFlash(hasFlash)
                .interchangeableLens(interchangeableLens)
                .fixedLens(fixedLens)
                .shutterSpeedRange(shutterSpeedRange)
                .isoMin(isoMin)
                .isoMax(isoMax)
                .notes(notes)
                .build();
    }

    /** 整份取代（PUT 語意）。參數順序與 {@link #create} 相同。 */
    public void update(String brand, String model, CameraFormat format,
                       CameraType cameraType, FocusType focusType, FilmAdvance filmAdvance,
                       Boolean hasFlash, Boolean interchangeableLens, String fixedLens,
                       String shutterSpeedRange, Integer isoMin, Integer isoMax, String notes) {
        requireValidSpecs(interchangeableLens, fixedLens, isoMin, isoMax);
        this.brand = normalizeName(brand);
        this.model = normalizeName(model);
        this.format = format;
        this.cameraType = cameraType;
        this.focusType = focusType;
        this.filmAdvance = filmAdvance;
        this.hasFlash = hasFlash;
        this.interchangeableLens = interchangeableLens;
        this.fixedLens = fixedLens;
        this.shutterSpeedRange = shutterSpeedRange;
        this.isoMin = isoMin;
        this.isoMax = isoMax;
        this.notes = notes;
    }

    /** 顯示用名稱：有品牌時是「品牌 型號」，沒有時只有型號。 */
    public String getDisplayName() {
        return brand == null ? model : brand + " " + model;
    }

    /**
     * 名稱正規化：去頭尾空白、連續空白壓成一個，空白字串視為 null。
     *
     * <p>必須與 V2 migration 搬遷舊資料時的規則一致，
     * 唯一索引 {@code uq_camera_brand_model} 才能正確判斷「同一台相機」。
     * 設為 public，是讓 Service 在寫入前就能用同一套規則檢查重複。
     */
    public static String normalizeName(String raw) {
        if (raw == null) {
            return null;
        }
        String normalized = raw.strip().replaceAll("\\s+", " ");
        return normalized.isEmpty() ? null : normalized;
    }

    private static void requireValidSpecs(Boolean interchangeableLens, String fixedLens,
                                          Integer isoMin, Integer isoMax) {
        if (Boolean.TRUE.equals(interchangeableLens) && fixedLens != null) {
            throw new InvalidCameraException("可換鏡頭的相機不應填寫定焦鏡頭");
        }
        if (isoMin != null && isoMax != null && isoMin > isoMax) {
            throw new InvalidCameraException(
                    "ISO 下限（%d）不可大於上限（%d）".formatted(isoMin, isoMax));
        }
    }
}
