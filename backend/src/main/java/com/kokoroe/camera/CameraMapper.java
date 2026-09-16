package com.kokoroe.camera;

import com.kokoroe.camera.dto.CameraResponse;
import com.kokoroe.camera.dto.CameraSummaryResponse;
import com.kokoroe.camera.dto.CreateCameraRequest;
import com.kokoroe.camera.dto.UpdateCameraRequest;

/** Entity ↔ DTO 轉換，理由同 {@code FilmRollMapper}。 */
public final class CameraMapper {

    private CameraMapper() {
        throw new AssertionError("工具類別不應被實例化");
    }

    public static Camera toEntity(CreateCameraRequest request) {
        return Camera.create(
                request.brand(),
                request.model(),
                request.format(),
                request.cameraType(),
                request.focusType(),
                request.filmAdvance(),
                request.hasFlash(),
                request.interchangeableLens(),
                request.fixedLens(),
                request.shutterSpeedRange(),
                request.isoMin(),
                request.isoMax(),
                request.notes()
        );
    }

    public static void applyUpdate(Camera camera, UpdateCameraRequest request) {
        camera.update(
                request.brand(),
                request.model(),
                request.format(),
                request.cameraType(),
                request.focusType(),
                request.filmAdvance(),
                request.hasFlash(),
                request.interchangeableLens(),
                request.fixedLens(),
                request.shutterSpeedRange(),
                request.isoMin(),
                request.isoMax(),
                request.notes()
        );
    }

    public static CameraResponse toResponse(Camera entity) {
        return new CameraResponse(
                entity.getId(),
                entity.getBrand(),
                entity.getModel(),
                entity.getDisplayName(),
                entity.getFormat(),
                entity.getCameraType(),
                entity.getFocusType(),
                entity.getFilmAdvance(),
                entity.getHasFlash(),
                entity.getInterchangeableLens(),
                entity.getFixedLens(),
                entity.getShutterSpeedRange(),
                entity.getIsoMin(),
                entity.getIsoMax(),
                entity.getNotes(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    /** {@code camera} 可為 null（卷期沒有指定相機），此時回傳 null，JSON 裡就不會出現這個欄位。 */
    public static CameraSummaryResponse toSummary(Camera camera) {
        return camera == null ? null : new CameraSummaryResponse(camera.getId(), camera.getDisplayName());
    }
}
