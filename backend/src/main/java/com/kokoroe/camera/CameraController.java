package com.kokoroe.camera;

import com.kokoroe.camera.dto.CameraResponse;
import com.kokoroe.camera.dto.CreateCameraRequest;
import com.kokoroe.camera.dto.UpdateCameraRequest;
import com.kokoroe.common.dto.PageResponse;
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
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

/** 相機 REST API。這一層的職責範圍同 {@code FilmRollController}。 */
@RestController
@RequestMapping("/api/v1/cameras")
@RequiredArgsConstructor
public class CameraController {

    private final CameraService cameraService;

    @PostMapping
    public ResponseEntity<CameraResponse> create(@Valid @RequestBody CreateCameraRequest request) {
        CameraResponse created = cameraService.create(request);
        return ResponseEntity
                .created(URI.create("/api/v1/cameras/" + created.id()))
                .body(created);
    }

    /**
     * 分頁列出相機，預設依品牌、型號排序。
     *
     * <p>預設每頁 100 筆（也是上限）：個人的相機數量通常一頁就放得下，
     * 前端的相機下拉選單打一次就能拿到全部。
     */
    @GetMapping
    public PageResponse<CameraResponse> list(
            @PageableDefault(size = 100, sort = {"brand", "model"}, direction = Sort.Direction.ASC)
            Pageable pageable) {
        return cameraService.list(pageable);
    }

    @GetMapping("/{id}")
    public CameraResponse getById(@PathVariable Long id) {
        return cameraService.getById(id);
    }

    @PutMapping("/{id}")
    public CameraResponse update(@PathVariable Long id,
                                 @Valid @RequestBody UpdateCameraRequest request) {
        return cameraService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        cameraService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
