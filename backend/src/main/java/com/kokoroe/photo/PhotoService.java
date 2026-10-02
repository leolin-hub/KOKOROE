package com.kokoroe.photo;

import com.kokoroe.filmroll.FilmRollNotFoundException;
import com.kokoroe.filmroll.FilmRollRepository;
import com.kokoroe.photo.ImageProcessor.ProcessedImage;
import com.kokoroe.photo.dto.PhotoResponse;
import com.kokoroe.storage.ObjectStorage;
import com.kokoroe.storage.StoredObject;
import com.kokoroe.storage.StoredObjectNotFoundException;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.OptionalInt;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * 照片的商業邏輯：上傳、列出、讀取檔案、刪除。
 *
 * <p>交易設定與 {@code FilmRollService} 相同：類別預設唯讀，寫入的方法個別覆寫。
 * 上傳是例外，見 {@link #upload}。
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PhotoService {

    private static final Logger log = LoggerFactory.getLogger(PhotoService.class);

    static final int MAX_FRAME_NUMBER = 99;

    /**
     * 同時最多處理幾張上傳。實測處理一張 4000 萬像素的照片，heap 尖峰約 200 MB
     * （-Xmx180m 會 OutOfMemoryError、220m 可以）。2 GB 的小 VM 上 JVM 預設只拿四分之一（512 MB），
     * 兩張同時處理再加上其他請求就很緊。
     * 前端本來就逐張上傳，一次一張不會變慢；朋友同時上傳時後到的會排隊（最多等 30 秒）。
     */
    private static final int MAX_CONCURRENT_UPLOADS = 1;
    private static final long UPLOAD_SLOT_WAIT_SECONDS = 30;

    private static final String JPEG = MediaType.IMAGE_JPEG_VALUE;

    private final PhotoRepository photoRepository;
    private final FilmRollRepository filmRollRepository;
    private final ObjectStorage objectStorage;
    private final ImageProcessor imageProcessor;
    private final PhotoFilesCleaner photoFilesCleaner;
    private final ApplicationEventPublisher eventPublisher;

    // 有初始值的 final 欄位不會被 @RequiredArgsConstructor 放進建構子
    private final Semaphore uploadSlots = new Semaphore(MAX_CONCURRENT_UPLOADS);

    public List<PhotoResponse> listByRoll(Long filmRollId) {
        requireRollExists(filmRollId);
        return photoRepository.findByFilmRollIdOrderByFrameNumberAsc(filmRollId).stream()
                .map(PhotoMapper::toResponse)
                .toList();
    }

    public PhotoResponse getById(Long id) {
        return PhotoMapper.toResponse(findOrThrow(id));
    }

    /**
     * 開啟某個版本的圖檔。呼叫端負責關閉。
     *
     * <p>{@code NOT_SUPPORTED} 的理由同 {@link #upload}：向儲存空間要檔案時不要佔著資料庫連線。
     * 印樣一次會同時要幾十張縮圖，儲存空間一慢，連線池（預設 10 條）就會被這些請求佔滿。
     * {@code findById} 自己會開一個短交易。
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public StoredObject openContent(Long id, PhotoVariant variant) {
        Photo photo = findOrThrow(id);
        try {
            return objectStorage.get(photo.objectKey(variant));
        } catch (StoredObjectNotFoundException ex) {
            // 資料庫有紀錄、檔案卻不見了：兩邊不同步，要查。對使用者來說就是找不到這張照片。
            log.error("照片 {} 的 {} 檔案不存在", id, variant, ex);
            throw new PhotoNotFoundException(id);
        }
    }

    /**
     * 上傳一張照片。
     *
     * <h2>格號怎麼決定</h2>
     * 有指定 {@code requestedFrame} 就用它；沒有就從檔名取最後一組數字；
     * 都沒有就接在這卷目前最大格號的後面（第一張是 1）。
     *
     * <h2>為什麼不在交易裡做</h2>
     * 解碼、縮圖、上傳到儲存空間可能要好幾秒。包在交易裡會一路佔著一條資料庫連線，
     * 所以用 {@code NOT_SUPPORTED} 暫停類別層級的交易，只有最後寫入紀錄那一步才開短交易。
     * 代價是要自己處理「檔案存好了、紀錄卻寫不進去」：寫入失敗時把剛存的檔案刪掉。
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public PhotoResponse upload(Long filmRollId, MultipartFile file, Integer requestedFrame) {
        requireRollExists(filmRollId);
        if (file.isEmpty()) {
            throw new InvalidPhotoException("檔案是空的");
        }
        String displayName = UploadFilename.displayName(file.getOriginalFilename()).orElse(null);
        int frameNumber = resolveFrameNumber(filmRollId, requestedFrame, displayName);

        acquireUploadSlot();
        try {
            byte[] original = file.getBytes();
            ProcessedImage processed = imageProcessor.process(original);
            Photo photo = Photo.create(filmRollId, frameNumber, newStorageKey(filmRollId), displayName,
                    processed.width(), processed.height(), original.length);
            try {
                objectStorage.put(photo.objectKey(PhotoVariant.ORIGINAL), original, JPEG);
                objectStorage.put(photo.objectKey(PhotoVariant.WEB), processed.web(), JPEG);
                objectStorage.put(photo.objectKey(PhotoVariant.THUMB), processed.thumb(), JPEG);
                // 兩個請求同時搶同一格時，唯一約束會在這裡擋下（DataIntegrityViolationException → 409）
                return PhotoMapper.toResponse(photoRepository.saveAndFlush(photo));
            } catch (RuntimeException ex) {
                photoFilesCleaner.deleteQuietly(List.of(photo.getStorageKey()));
                throw ex;
            }
        } catch (IOException ex) {
            // 讀不到 Tomcat 暫存的上傳檔，是伺服器端的問題，不是使用者的錯
            throw new UncheckedIOException("讀取上傳檔案失敗", ex);
        } finally {
            uploadSlots.release();
        }
    }

    @Transactional
    public void delete(Long id) {
        Photo photo = findOrThrow(id);
        photoRepository.delete(photo);
        eventPublisher.publishEvent(new PhotoFilesOrphanedEvent(List.of(photo.getStorageKey())));
    }

    /**
     * 卷期即將被刪除：排定在交易提交後清掉它所有照片的檔案。
     *
     * <p>由 {@code FilmRollService.delete} 在同一個交易裡呼叫。
     * 照片紀錄本身不用刪，刪卷期時資料庫的 {@code ON DELETE CASCADE} 會一起刪掉。
     */
    @Transactional
    public void cleanUpFilesOfRoll(Long filmRollId) {
        List<String> storageKeys = photoRepository.findStorageKeysByFilmRollId(filmRollId);
        if (!storageKeys.isEmpty()) {
            eventPublisher.publishEvent(new PhotoFilesOrphanedEvent(storageKeys));
        }
    }

    private int resolveFrameNumber(Long filmRollId, Integer requestedFrame, String displayName) {
        int frameNumber;
        if (requestedFrame != null) {
            if (requestedFrame < 0 || requestedFrame > MAX_FRAME_NUMBER) {
                throw new InvalidPhotoException("格號必須介於 0 到 %d".formatted(MAX_FRAME_NUMBER));
            }
            frameNumber = requestedFrame;
        } else {
            OptionalInt fromFilename = displayName == null
                    ? OptionalInt.empty()
                    : UploadFilename.frameNumber(displayName);
            frameNumber = fromFilename.orElseGet(() -> nextFrameNumber(filmRollId));
        }
        // 先擋一次，省下解碼與上傳的工夫；真正的保證是資料庫的唯一約束
        if (photoRepository.existsByFilmRollIdAndFrameNumber(filmRollId, frameNumber)) {
            throw new DuplicateFrameException(frameNumber);
        }
        return frameNumber;
    }

    private int nextFrameNumber(Long filmRollId) {
        int next = photoRepository.findMaxFrameNumber(filmRollId).map(max -> max + 1).orElse(1);
        if (next > MAX_FRAME_NUMBER) {
            throw new InvalidPhotoException("這卷已經沒有空的格號了");
        }
        return next;
    }

    private void acquireUploadSlot() {
        try {
            if (!uploadSlots.tryAcquire(UPLOAD_SLOT_WAIT_SECONDS, TimeUnit.SECONDS)) {
                throw new UploadBusyException();
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new UploadBusyException();
        }
    }

    /** 隨機 UUID：猜不到別人照片的位置，也不會因為格號重複而互相覆蓋。 */
    private static String newStorageKey(Long filmRollId) {
        return "rolls/%d/%s".formatted(filmRollId, UUID.randomUUID());
    }

    private void requireRollExists(Long filmRollId) {
        if (!filmRollRepository.existsById(filmRollId)) {
            throw new FilmRollNotFoundException(filmRollId);
        }
    }

    private Photo findOrThrow(Long id) {
        return photoRepository.findById(id)
                .orElseThrow(() -> new PhotoNotFoundException(id));
    }
}
