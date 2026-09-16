package com.kokoroe.camera;

import com.kokoroe.camera.dto.CameraResponse;
import com.kokoroe.camera.dto.CreateCameraRequest;
import com.kokoroe.camera.dto.UpdateCameraRequest;
import com.kokoroe.common.dto.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 相機的商業邏輯。交易與例外的慣例同 {@code FilmRollService}。 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CameraService {

    private final CameraRepository cameraRepository;

    @Transactional
    public CameraResponse create(CreateCameraRequest request) {
        Camera camera = CameraMapper.toEntity(request);
        requireUnique(camera.getBrand(), camera.getModel(), null);
        return CameraMapper.toResponse(cameraRepository.save(camera));
    }

    public PageResponse<CameraResponse> list(Pageable pageable) {
        return PageResponse.from(cameraRepository.findAll(pageable), CameraMapper::toResponse);
    }

    public CameraResponse getById(Long id) {
        return CameraMapper.toResponse(findOrThrow(id));
    }

    @Transactional
    public CameraResponse update(Long id, UpdateCameraRequest request) {
        Camera camera = findOrThrow(id);

        // 一定要在修改實體「之前」檢查重複：修改後再查詢，Hibernate 會先自動 flush，
        // UPDATE 撞到唯一索引，拿到的就是籠統的資料庫例外，而不是 DuplicateCameraException。
        requireUnique(Camera.normalizeName(request.brand()), Camera.normalizeName(request.model()), id);
        requireFormatFitsRolls(camera, request.format());
        CameraMapper.applyUpdate(camera, request);

        return CameraMapper.toResponse(cameraRepository.saveAndFlush(camera));
    }

    @Transactional
    public void delete(Long id) {
        Camera camera = findOrThrow(id);
        long rollCount = cameraRepository.countFilmRollsUsing(id);
        if (rollCount > 0) {
            throw new CameraInUseException(id, rollCount);
        }
        cameraRepository.delete(camera);
    }

    private void requireUnique(String brand, String model, Long excludeId) {
        if (cameraRepository.existsDuplicate(brand, model, excludeId)) {
            throw new DuplicateCameraException(brand == null ? model : brand + " " + model);
        }
    }

    /** 改片幅時，使用中的卷期必須都還裝得進新片幅；片幅沒變就不必查。 */
    private void requireFormatFitsRolls(Camera camera, CameraFormat newFormat) {
        if (newFormat == camera.getFormat()) {
            return;
        }
        long conflicting = cameraRepository.countFilmRollsWithOtherFormat(camera.getId(), newFormat.getFilmFormat());
        if (conflicting > 0) {
            throw new CameraFormatConflictException(camera.getDisplayName(), newFormat, conflicting);
        }
    }

    private Camera findOrThrow(Long id) {
        return cameraRepository.findById(id)
                .orElseThrow(() -> new CameraNotFoundException(id));
    }
}
