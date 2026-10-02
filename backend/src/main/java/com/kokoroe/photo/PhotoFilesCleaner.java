package com.kokoroe.photo;

import com.kokoroe.storage.ObjectStorage;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Collection;

/**
 * 刪除照片在儲存空間裡的檔案。
 *
 * <h2>為什麼等交易提交之後才刪</h2>
 * 資料庫可以 rollback，儲存空間不行。如果先刪檔案、交易卻失敗了，
 * 資料庫還留著紀錄，檔案卻已經沒了，畫面上就是一堆破圖。
 * 反過來，交易成功但刪檔失敗，只會在儲存空間留下沒人引用的孤兒檔案：佔空間，但不影響使用。
 * 兩害相權取其輕。
 *
 * <p>刪檔失敗只記 warn log，不往外丟：此時交易已經提交，使用者的刪除確實成功了。
 */
@Component
@RequiredArgsConstructor
public class PhotoFilesCleaner {

    private static final Logger log = LoggerFactory.getLogger(PhotoFilesCleaner.class);

    private final ObjectStorage objectStorage;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onPhotoFilesOrphaned(PhotoFilesOrphanedEvent event) {
        deleteQuietly(event.storageKeys());
    }

    /** 也給上傳失敗時的補償清理使用，那時沒有交易。 */
    void deleteQuietly(Collection<String> storageKeys) {
        try {
            objectStorage.deleteAll(storageKeys.stream()
                    .flatMap(storageKey -> Photo.allObjectKeys(storageKey).stream())
                    .toList());
        } catch (RuntimeException ex) {
            log.warn("照片檔案刪除失敗，儲存空間留下孤兒檔案：{}", storageKeys, ex);
        }
    }
}
