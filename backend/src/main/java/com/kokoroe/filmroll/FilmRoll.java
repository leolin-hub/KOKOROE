package com.kokoroe.filmroll;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EnumType;
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
import java.time.LocalDate;

/**
 * 底片卷期 —— 本專案的核心聚合根。
 *
 * <h2>Lombok 使用上的刻意取捨</h2>
 * 只用 {@code @Getter} / {@code @Builder} / {@code @NoArgsConstructor}，
 * <b>絕不用 {@code @Data} 或 {@code @EqualsAndHashCode}</b>。
 * 後者會把所有欄位（含 id）納入 hashCode，導致同一個實體在「尚未持久化」與
 * 「已持久化」兩個時間點的 hashCode 不同，一旦被放進 {@code HashSet} 就會找不回來。
 *
 * <h2>不提供 setter 的理由</h2>
 * 對外只開放三個語意明確的變更方法，讓「什麼可以改、改的時候要守什麼規則」
 * 跟資料放在一起，而不是散落在各個 Service。
 */
@Entity
@Table(name = "film_roll")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class FilmRoll {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "film_name", nullable = false, length = 100)
    private String filmName;

    @Column(name = "brand", length = 50)
    private String brand;

    @Column(name = "iso", nullable = false)
    private Integer iso;

    /** {@code EnumType.STRING} 是硬性要求，理由見 {@link FilmFormat} 與 V1 migration 的註解。 */
    @Enumerated(EnumType.STRING)
    @Column(name = "format", nullable = false, length = 16)
    private FilmFormat format;

    /** 增減感格數：正數為推感（push），負數為減感（pull），0 為標準沖洗。 */
    @Column(name = "push_pull_stops", nullable = false)
    private Integer pushPullStops;

    @Column(name = "loaded_at", nullable = false)
    private LocalDate loadedAt;

    /** 拍完日期。仍在拍攝中時為 null，屬於正常狀態而非缺漏資料。 */
    @Column(name = "finished_at")
    private LocalDate finishedAt;

    @Column(name = "camera_name", length = 100)
    private String cameraName;

    @Column(name = "lens_name", length = 100)
    private String lensName;

    @Column(name = "notes", columnDefinition = "text")
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private FilmRollStatus status;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    // ---------------------------------------------------------------------
    // 工廠方法與變更行為
    // ---------------------------------------------------------------------

    /**
     * 建立新卷期。走這個入口而不是直接用 builder，是為了讓不變條件（invariant）
     * 一定會被檢查到 —— builder 本身無法強制驗證。
     */
    public static FilmRoll create(String filmName, String brand, Integer iso, FilmFormat format,
                                  Integer pushPullStops, LocalDate loadedAt, LocalDate finishedAt,
                                  String cameraName, String lensName, String notes,
                                  FilmRollStatus status) {
        requireValidDateRange(loadedAt, finishedAt);
        return FilmRoll.builder()
                .filmName(filmName)
                .brand(brand)
                .iso(iso)
                .format(format)
                .pushPullStops(pushPullStops)
                .loadedAt(loadedAt)
                .finishedAt(finishedAt)
                .cameraName(cameraName)
                .lensName(lensName)
                .notes(notes)
                .status(status)
                .build();
    }

    /** 修改底片本身的屬性（買錯記錯、事後補正沖洗參數）。 */
    public void updateFilmDetails(String filmName, String brand, Integer iso,
                                  FilmFormat format, Integer pushPullStops) {
        this.filmName = filmName;
        this.brand = brand;
        this.iso = iso;
        this.format = format;
        this.pushPullStops = pushPullStops;
    }

    /** 修改這卷片的拍攝紀錄（日期、器材、筆記）。 */
    public void updateShootingLog(LocalDate loadedAt, LocalDate finishedAt,
                                  String cameraName, String lensName, String notes) {
        requireValidDateRange(loadedAt, finishedAt);
        this.loadedAt = loadedAt;
        this.finishedAt = finishedAt;
        this.cameraName = cameraName;
        this.lensName = lensName;
        this.notes = notes;
    }

    /**
     * 推進狀態。規則本身由 {@link FilmRollStatus#canTransitionTo} 定義，
     * 由實體負責強制執行 —— 這樣不論從哪個 Service 呼叫，都不可能繞過。
     *
     * @throws IllegalStatusTransitionException 當試圖逆向流轉時
     */
    public void changeStatus(FilmRollStatus newStatus) {
        if (!this.status.canTransitionTo(newStatus)) {
            throw new IllegalStatusTransitionException(this.status, newStatus);
        }
        this.status = newStatus;
    }

    private static void requireValidDateRange(LocalDate loadedAt, LocalDate finishedAt) {
        if (loadedAt != null && finishedAt != null && finishedAt.isBefore(loadedAt)) {
            throw new InvalidFilmRollException(
                    "拍完日期（%s）不可早於裝片日期（%s）".formatted(finishedAt, loadedAt));
        }
    }
}
