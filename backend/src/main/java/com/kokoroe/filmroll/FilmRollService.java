package com.kokoroe.filmroll;

import com.kokoroe.camera.Camera;
import com.kokoroe.camera.CameraRepository;
import com.kokoroe.common.dto.PageResponse;
import com.kokoroe.filmroll.dto.CreateFilmRollRequest;
import com.kokoroe.filmroll.dto.FilmRollResponse;
import com.kokoroe.filmroll.dto.UpdateFilmRollRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 卷期的商業邏輯。
 *
 * <p>類別層級標 {@code readOnly = true}，只有真正會寫入的方法才覆寫為可寫交易。
 * 唯讀交易能讓 JDBC driver 與資料庫跳過部分同步開銷，也避免不小心寫入。
 *
 * <p>此層完全不認識 HTTP：不出現 {@code ResponseEntity}、不出現狀態碼。
 * 錯誤一律用領域例外表達，由 {@code GlobalExceptionHandler} 統一翻譯成 HTTP 語意。
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FilmRollService {

    private final FilmRollRepository filmRollRepository;
    private final CameraRepository cameraRepository;

    @Transactional
    public FilmRollResponse create(CreateFilmRollRequest request) {
        Camera camera = findCameraOrReject(request.cameraId());
        FilmRoll saved = filmRollRepository.save(FilmRollMapper.toEntity(request, camera));
        return FilmRollMapper.toResponse(saved);
    }

    public PageResponse<FilmRollResponse> list(FilmRollStatus status, Pageable pageable) {
        Page<FilmRoll> page = (status == null)
                ? filmRollRepository.findAll(pageable)
                : filmRollRepository.findByStatus(status, pageable);
        return PageResponse.from(page, FilmRollMapper::toResponse);
    }

    public FilmRollResponse getById(Long id) {
        return FilmRollMapper.toResponse(findOrThrow(id));
    }

    @Transactional
    public FilmRollResponse update(Long id, UpdateFilmRollRequest request) {
        FilmRoll filmRoll = findOrThrow(id);

        filmRoll.updateFilmDetails(
                request.filmName(), request.brand(), request.iso(),
                request.format(), request.pushPullStops());
        filmRoll.updateShootingLog(
                request.loadedAt(), request.finishedAt(),
                findCameraOrReject(request.cameraId()), request.lensName(), request.notes());
        filmRoll.changeStatus(request.status());

        // 用 saveAndFlush 強制立即 flush，讓 @LastModifiedDate 在此刻就被寫入。
        // 若只依賴交易結束時的 dirty checking，回傳的 DTO 會帶著尚未更新的 updatedAt。
        return FilmRollMapper.toResponse(filmRollRepository.saveAndFlush(filmRoll));
    }

    @Transactional
    public void delete(Long id) {
        // 先查再刪，是為了讓「刪除不存在的資料」明確回 404，
        // 而不是靜默成功 —— 後者會讓前端誤以為刪掉了某筆其實不存在的資料。
        filmRollRepository.delete(findOrThrow(id));
    }

    /**
     * 依 id 找相機；沒指定時回 null。
     *
     * <p>找不到時回 400 而不是 404：404 代表「網址指到的資源不存在」，
     * 這裡網址沒問題，是請求內容引用了不存在的相機。
     */
    private Camera findCameraOrReject(Long cameraId) {
        if (cameraId == null) {
            return null;
        }
        return cameraRepository.findById(cameraId)
                .orElseThrow(() -> new InvalidFilmRollException("找不到 id 為 %d 的相機".formatted(cameraId)));
    }

    private FilmRoll findOrThrow(Long id) {
        return filmRollRepository.findById(id)
                .orElseThrow(() -> new FilmRollNotFoundException(id));
    }
}
