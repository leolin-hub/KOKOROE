package com.kokoroe.filmroll;

import com.kokoroe.camera.Camera;
import com.kokoroe.camera.CameraMapper;
import com.kokoroe.filmroll.dto.CreateFilmRollRequest;
import com.kokoroe.filmroll.dto.FilmRollResponse;

/**
 * Entity ↔ DTO 轉換。
 *
 * <p>做成無狀態的工具類別而非 Spring bean：它沒有任何相依，做成 bean 只會多一層
 * 注入的噪音，也讓單元測試得多做一次 mock。純函式就用純函式的形式表達。
 *
 * <p>此階段規模還小，手寫映射比引入 MapStruct 更直接；等到映射數量成長、
 * 或出現巢狀結構時再導入自動映射工具才划算。
 */
public final class FilmRollMapper {

    private FilmRollMapper() {
        throw new AssertionError("工具類別不應被實例化");
    }

    /** @param camera 由 Service 依 {@code request.cameraId()} 查好的相機，可為 null */
    public static FilmRoll toEntity(CreateFilmRollRequest request, Camera camera) {
        return FilmRoll.create(
                request.filmName(),
                request.brand(),
                request.iso(),
                request.format(),
                request.pushPullStops(),
                request.loadedAt(),
                request.finishedAt(),
                camera,
                request.lensName(),
                request.notes(),
                request.status()
        );
    }

    public static FilmRollResponse toResponse(FilmRoll entity) {
        return new FilmRollResponse(
                entity.getId(),
                entity.getFilmName(),
                entity.getBrand(),
                entity.getIso(),
                entity.getFormat(),
                entity.getPushPullStops(),
                entity.getLoadedAt(),
                entity.getFinishedAt(),
                CameraMapper.toSummary(entity.getCamera()),
                entity.getLensName(),
                entity.getNotes(),
                entity.getStatus(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
