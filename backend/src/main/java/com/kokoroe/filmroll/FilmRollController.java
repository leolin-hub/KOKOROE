package com.kokoroe.filmroll;

import com.kokoroe.common.dto.PageResponse;
import com.kokoroe.filmroll.dto.CreateFilmRollRequest;
import com.kokoroe.filmroll.dto.FilmRollResponse;
import com.kokoroe.filmroll.dto.UpdateFilmRollRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

/**
 * 卷期 REST API。
 *
 * <p>這一層只做三件事：路由、以 {@code @Valid} 觸發輸入驗證、把結果包成正確的 HTTP 回應。
 * 任何 if/else 商業判斷都不該出現在這裡 —— 一旦出現，就是該往 Service 搬的訊號。
 */
@RestController
@RequestMapping("/api/v1/film-rolls")
@RequiredArgsConstructor
public class FilmRollController {

    private final FilmRollService filmRollService;

    /** @return 201 Created，並在 Location header 指出新資源位置（RESTful 慣例）。 */
    @PostMapping
    public ResponseEntity<FilmRollResponse> create(@Valid @RequestBody CreateFilmRollRequest request) {
        FilmRollResponse created = filmRollService.create(request);
        return ResponseEntity
                .created(URI.create("/api/v1/film-rolls/" + created.id()))
                .body(created);
    }

    /**
     * 分頁列出卷期，可依狀態篩選。
     *
     * <p>預設以裝片日期新到舊排序 —— 這是實際使用時最想先看到的順序。
     * 頁面大小的上限由 {@code spring.data.web.pageable.max-page-size} 控制，
     * 避免有人用 {@code ?size=999999} 把整張表撈走。
     */
    @GetMapping
    public PageResponse<FilmRollResponse> list(
            @RequestParam(required = false) FilmRollStatus status,
            @PageableDefault(size = 20, sort = "loadedAt", direction = Sort.Direction.DESC)
            Pageable pageable) {
        return filmRollService.list(status, pageable);
    }

    @GetMapping("/{id}")
    public FilmRollResponse getById(@PathVariable Long id) {
        return filmRollService.getById(id);
    }

    @PutMapping("/{id}")
    public FilmRollResponse update(@PathVariable Long id,
                                   @Valid @RequestBody UpdateFilmRollRequest request) {
        return filmRollService.update(id, request);
    }

    /** @return 204 No Content —— 刪除成功沒有內容可回，不該硬塞一個空 body。 */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        filmRollService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
