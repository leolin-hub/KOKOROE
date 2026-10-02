package com.kokoroe.photo;

import com.kokoroe.photo.dto.PhotoResponse;
import com.kokoroe.storage.StoredObject;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.time.Duration;
import java.util.List;

/**
 * 照片 REST API。
 *
 * <p>照片屬於卷期，所以「列出」與「上傳」掛在 {@code /film-rolls/{id}/photos} 底下；
 * 單張照片有自己的 id，讀取與刪除直接用 {@code /photos/{id}}，不必再帶卷期 id。
 *
 * <p>圖檔由後端轉送，而不是發給前端儲存空間的限時網址：
 * 網址固定，瀏覽器快取才有用；和網站同網域，Cloudflare Access 與之後的登入自然就保護到圖檔。
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class PhotoController {

    /**
     * 照片內容永遠不會變（換照片 = 刪掉再傳，id 也會不同），可以讓瀏覽器快取一年、不必回來確認。
     * {@code private}：只准使用者自己的瀏覽器快取，CDN 等共用快取不行，之後加了登入也不會外流。
     */
    private static final CacheControl IMMUTABLE = CacheControl.maxAge(Duration.ofDays(365))
            .cachePrivate()
            .immutable();

    private final PhotoService photoService;

    /** 依格號排序，不分頁（一卷最多 100 張）。卷期不存在時 404。 */
    @GetMapping("/film-rolls/{filmRollId}/photos")
    public List<PhotoResponse> list(@PathVariable Long filmRollId) {
        return photoService.listByRoll(filmRollId);
    }

    /**
     * 上傳一張 JPEG。一次一張：前端逐張上傳，每張都有自己的成功或失敗，不會一張壞掉整批重來。
     *
     * @param frameNumber 選填；沒給就從檔名推，詳見 {@link PhotoService#upload}
     */
    @PostMapping(path = "/film-rolls/{filmRollId}/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PhotoResponse> upload(@PathVariable Long filmRollId,
                                                @RequestParam MultipartFile file,
                                                @RequestParam(required = false) Integer frameNumber) {
        PhotoResponse created = photoService.upload(filmRollId, file, frameNumber);
        return ResponseEntity
                .created(URI.create("/api/v1/photos/" + created.id()))
                .body(created);
    }

    @GetMapping("/photos/{id}")
    public PhotoResponse getById(@PathVariable Long id) {
        return photoService.getById(id);
    }

    /**
     * 圖檔本身。{@code variant} 是 {@code thumb}、{@code web} 或 {@code original}。
     *
     * <p>{@link InputStreamResource} 讓 Spring 邊讀邊寫，寫完會自動關閉串流。
     *
     * <p>原圖是使用者上傳的原檔，JPEG 後面可能夾帶 HTML 之類的內容，所以加兩層保險：
     * {@code nosniff} 叫瀏覽器照 Content-Type 解讀、不要自己猜；
     * CSP {@code sandbox} 讓這個網址就算被直接打開，也不能執行任何腳本。
     * 兩者都不影響 {@code <img>} 正常顯示。
     */
    @GetMapping("/photos/{id}/{variant}")
    public ResponseEntity<InputStreamResource> content(@PathVariable Long id,
                                                       @PathVariable PhotoVariant variant) {
        StoredObject object = photoService.openContent(id, variant);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .contentLength(object.contentLength())
                .cacheControl(IMMUTABLE)
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Security-Policy", "default-src 'none'; sandbox")
                .body(new InputStreamResource(object.content()));
    }

    @DeleteMapping("/photos/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        photoService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
