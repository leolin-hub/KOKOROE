package com.kokoroe.filmroll;

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

    @Transactional
    public FilmRollResponse create(CreateFilmRollRequest request) {
        FilmRoll saved = filmRollRepository.save(FilmRollMapper.toEntity(request));
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
                request.cameraName(), request.lensName(), request.notes());
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

    private FilmRoll findOrThrow(Long id) {
        return filmRollRepository.findById(id)
                .orElseThrow(() -> new FilmRollNotFoundException(id));
    }
}
