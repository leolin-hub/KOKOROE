package com.kokoroe.photo;

import com.kokoroe.filmroll.FilmRollNotFoundException;
import com.kokoroe.filmroll.FilmRollRepository;
import com.kokoroe.photo.ImageProcessor.ProcessedImage;
import com.kokoroe.storage.ObjectStorage;
import com.kokoroe.storage.StoredObjectNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.endsWith;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

/**
 * PhotoService 單元測試：重點是格號規則，以及「檔案存了、紀錄沒寫成」時有沒有把檔案清掉。
 * 真正的圖片處理與儲存交給 ImageProcessorTest 和整合測試。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("PhotoService")
class PhotoServiceTest {

    private static final long ROLL_ID = 7L;
    private static final ProcessedImage PROCESSED =
            new ProcessedImage(new byte[]{1}, new byte[]{2}, 3000, 2000);

    @Mock
    private PhotoRepository photoRepository;
    @Mock
    private FilmRollRepository filmRollRepository;
    @Mock
    private ObjectStorage objectStorage;
    @Mock
    private ImageProcessor imageProcessor;
    @Mock
    private PhotoFilesCleaner photoFilesCleaner;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private PhotoService photoService;

    private static MockMultipartFile file(String filename) {
        return new MockMultipartFile("file", filename, "image/jpeg", new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF});
    }

    @Nested
    @DisplayName("upload：格號規則")
    class FrameNumberRules {

        @BeforeEach
        void rollExists() {
            when(filmRollRepository.existsById(ROLL_ID)).thenReturn(true);
            lenient().when(imageProcessor.process(any())).thenReturn(PROCESSED);
            lenient().when(photoRepository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        }

        private int uploadedFrame(String filename, Integer requested) {
            return photoService.upload(ROLL_ID, file(filename), requested).frameNumber();
        }

        @Test
        @DisplayName("有指定格號就用指定的，即使檔名裡有別的數字")
        void shouldPreferRequestedFrame() {
            assertThat(uploadedFrame("000123_05.jpg", 12)).isEqualTo(12);
        }

        @Test
        @DisplayName("沒指定就從檔名取")
        void shouldUseFilename() {
            assertThat(uploadedFrame("000123_05.jpg", null)).isEqualTo(5);
        }

        @Test
        @DisplayName("檔名推不出來：第一張是 1，之後接在最大格號後面")
        void shouldAppendAfterMax() {
            when(photoRepository.findMaxFrameNumber(ROLL_ID)).thenReturn(Optional.empty());
            assertThat(uploadedFrame("scan.jpg", null)).isEqualTo(1);

            when(photoRepository.findMaxFrameNumber(ROLL_ID)).thenReturn(Optional.of(36));
            assertThat(uploadedFrame("scan.jpg", null)).isEqualTo(37);
        }

        @Test
        @DisplayName("已經用到第 99 格就沒有下一格可接")
        void shouldRejectWhenFull() {
            when(photoRepository.findMaxFrameNumber(ROLL_ID)).thenReturn(Optional.of(99));

            assertThatThrownBy(() -> uploadedFrame("scan.jpg", null))
                    .isInstanceOf(InvalidPhotoException.class);
            verifyNoInteractions(imageProcessor, objectStorage);
        }

        @Test
        @DisplayName("指定的格號超出 0–99")
        void shouldRejectOutOfRangeRequest() {
            assertThatThrownBy(() -> uploadedFrame("a.jpg", 100)).isInstanceOf(InvalidPhotoException.class);
            assertThatThrownBy(() -> uploadedFrame("a.jpg", -1)).isInstanceOf(InvalidPhotoException.class);
        }

        @Test
        @DisplayName("格號已被佔用：在解碼與上傳之前就擋下")
        void shouldRejectDuplicateBeforeProcessing() {
            when(photoRepository.existsByFilmRollIdAndFrameNumber(ROLL_ID, 5)).thenReturn(true);

            assertThatThrownBy(() -> uploadedFrame("000123_05.jpg", null))
                    .isInstanceOf(DuplicateFrameException.class)
                    .hasMessageContaining("5");
            verifyNoInteractions(imageProcessor, objectStorage);
        }

        @Test
        @DisplayName("明確指定的格號被佔用也要在處理之前擋下（不是只有從檔名推出來的才檢查）")
        void shouldRejectDuplicateRequestedFrameBeforeProcessing() {
            when(photoRepository.existsByFilmRollIdAndFrameNumber(ROLL_ID, 12)).thenReturn(true);

            assertThatThrownBy(() -> uploadedFrame("scan.jpg", 12))
                    .isInstanceOf(DuplicateFrameException.class)
                    .hasMessageContaining("12");
            verifyNoInteractions(imageProcessor, objectStorage);
            verify(photoRepository, never()).saveAndFlush(any());
        }

        @Test
        @DisplayName("格號的邊界：0 與 99 收，-1 與 100 拒絕；拒絕時不去處理圖片")
        void shouldAcceptBoundaryFramesAndRejectJustOutside() {
            assertThat(uploadedFrame("a.jpg", 0)).isEqualTo(0);
            assertThat(uploadedFrame("a.jpg", 99)).isEqualTo(99);

            assertThatThrownBy(() -> uploadedFrame("a.jpg", 100))
                    .isInstanceOf(InvalidPhotoException.class).hasMessageContaining("0 到 99");
            assertThatThrownBy(() -> uploadedFrame("a.jpg", -1))
                    .isInstanceOf(InvalidPhotoException.class).hasMessageContaining("0 到 99");
            // 前面兩次成功各呼叫一次；兩次被拒絕的不能再多呼叫
            verify(imageProcessor, times(2)).process(any());
        }

        @Test
        @DisplayName("最大格號是 98 時還能接第 99 格；是 99 才滿")
        void shouldAllowAppendingTheLastFrame() {
            when(photoRepository.findMaxFrameNumber(ROLL_ID)).thenReturn(Optional.of(98));

            assertThat(uploadedFrame("scan.jpg", null)).isEqualTo(99);
        }

        @Test
        @DisplayName("檔名裡的數字超出 0–99（相機流水號）：改接在最大格號後面")
        void shouldFallBackToAppendWhenFilenameNumberOutOfRange() {
            when(photoRepository.findMaxFrameNumber(ROLL_ID)).thenReturn(Optional.of(3));

            assertThat(uploadedFrame("IMG_4521.jpg", null)).isEqualTo(4);
        }

        @Test
        @DisplayName("檔名給了格號就直接用，不受目前最大格號影響（可以補傳前面的格）")
        void shouldUseFilenameFrameEvenIfBelowMax() {
            assertThat(uploadedFrame("000123_05.jpg", null)).isEqualTo(5);
            verify(photoRepository, never()).findMaxFrameNumber(anyLong());
        }

        @Test
        @DisplayName("指定了格號就不再去查最大格號")
        void shouldNotLookUpMaxWhenFrameRequested() {
            uploadedFrame("scan.jpg", 8);

            verify(photoRepository, never()).findMaxFrameNumber(anyLong());
        }

        @Test
        @DisplayName("沒有檔名：照樣能上傳，接在最大格號後面，originalFilename 存 null")
        void shouldHandleMissingFilename() {
            when(photoRepository.findMaxFrameNumber(ROLL_ID)).thenReturn(Optional.of(4));

            var response = photoService.upload(ROLL_ID, file(""), null);

            assertThat(response.frameNumber()).isEqualTo(5);
            assertThat(response.originalFilename()).isNull();
        }
    }

    @Nested
    @DisplayName("upload：存了什麼")
    class WhatGetsStored {

        @Test
        @DisplayName("三個版本各存到自己的 key、各自的內容與 image/jpeg；紀錄的寬高、大小、檔名、格號都對")
        void shouldStoreEachVariantUnderItsOwnKeyAndRecordMetadata() {
            when(filmRollRepository.existsById(ROLL_ID)).thenReturn(true);
            byte[] original = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 9, 8, 7};
            when(imageProcessor.process(original)).thenReturn(PROCESSED);
            when(photoRepository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
            MockMultipartFile upload = new MockMultipartFile(
                    "file", "C:\\scans\\000123_05.jpg", "image/jpeg", original);

            var response = photoService.upload(ROLL_ID, upload, null);

            ArgumentCaptor<Photo> saved = ArgumentCaptor.forClass(Photo.class);
            verify(photoRepository).saveAndFlush(saved.capture());
            Photo photo = saved.getValue();
            assertThat(photo.getFilmRollId()).isEqualTo(ROLL_ID);
            assertThat(photo.getFrameNumber()).isEqualTo(5);
            assertThat(photo.getOriginalFilename()).isEqualTo("000123_05.jpg");
            // 寬高來自處理後的結果（依 EXIF 轉正）；大小是原檔的 byte 數，不是任何縮圖的
            assertThat(photo.getWidth()).isEqualTo(3000);
            assertThat(photo.getHeight()).isEqualTo(2000);
            assertThat(photo.getSizeBytes()).isEqualTo(6L);
            assertThat(photo.getStorageKey())
                    .matches("rolls/7/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
            assertThat(response.frameNumber()).isEqualTo(5);

            String key = photo.getStorageKey();
            verify(objectStorage).put(key + "/original.jpg", original, "image/jpeg");
            verify(objectStorage).put(key + "/web.jpg", PROCESSED.web(), "image/jpeg");
            verify(objectStorage).put(key + "/thumb.jpg", PROCESSED.thumb(), "image/jpeg");
            verifyNoMoreInteractions(objectStorage);
            verifyNoInteractions(photoFilesCleaner);
        }

        @Test
        @DisplayName("每張照片的 storage key 不同（猜不到、也不會互相覆蓋）")
        void shouldUseDistinctStorageKeys() {
            when(filmRollRepository.existsById(ROLL_ID)).thenReturn(true);
            when(imageProcessor.process(any())).thenReturn(PROCESSED);
            when(photoRepository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

            photoService.upload(ROLL_ID, file("01.jpg"), null);
            photoService.upload(ROLL_ID, file("01.jpg"), null);

            ArgumentCaptor<Photo> saved = ArgumentCaptor.forClass(Photo.class);
            verify(photoRepository, times(2)).saveAndFlush(saved.capture());
            assertThat(saved.getAllValues()).extracting(Photo::getStorageKey).doesNotHaveDuplicates();
        }
    }

    @Nested
    @DisplayName("upload：失敗時的處理")
    class UploadFailures {

        @Test
        @DisplayName("卷期不存在 → 404，什麼都不做")
        void shouldRejectMissingRoll() {
            when(filmRollRepository.existsById(ROLL_ID)).thenReturn(false);

            assertThatThrownBy(() -> photoService.upload(ROLL_ID, file("01.jpg"), null))
                    .isInstanceOf(FilmRollNotFoundException.class);
            verifyNoInteractions(imageProcessor, objectStorage, photoRepository);
        }

        @Test
        @DisplayName("空檔案")
        void shouldRejectEmptyFile() {
            when(filmRollRepository.existsById(ROLL_ID)).thenReturn(true);
            MockMultipartFile empty = new MockMultipartFile("file", "01.jpg", "image/jpeg", new byte[0]);

            assertThatThrownBy(() -> photoService.upload(ROLL_ID, empty, null))
                    .isInstanceOf(InvalidPhotoException.class);
        }

        @Test
        @DisplayName("第二個版本存失敗：已存的檔案要清掉，紀錄不能寫")
        void shouldCleanUpWhenStoragePutFails() {
            when(filmRollRepository.existsById(ROLL_ID)).thenReturn(true);
            when(imageProcessor.process(any())).thenReturn(PROCESSED);
            // lenient：原圖那次 put 的參數不符合這個 stub，strict 模式會誤判成寫錯測試
            lenient().doThrow(new IllegalStateException("儲存空間掛了"))
                    .when(objectStorage).put(endsWith("/web.jpg"), any(), anyString());

            assertThatThrownBy(() -> photoService.upload(ROLL_ID, file("01.jpg"), null))
                    .isInstanceOf(IllegalStateException.class);

            verify(photoRepository, never()).saveAndFlush(any());
            assertCleanedUpKeyUnderRoll();
        }

        @Test
        @DisplayName("寫紀錄失敗（例如同時搶同一格）：三個版本都存好了也要清掉")
        void shouldCleanUpWhenSaveFails() {
            when(filmRollRepository.existsById(ROLL_ID)).thenReturn(true);
            when(imageProcessor.process(any())).thenReturn(PROCESSED);
            when(photoRepository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("uq_photo_roll_frame"));

            assertThatThrownBy(() -> photoService.upload(ROLL_ID, file("01.jpg"), null))
                    .isInstanceOf(DataIntegrityViolationException.class);

            ArgumentCaptor<Photo> saved = ArgumentCaptor.forClass(Photo.class);
            verify(photoRepository).saveAndFlush(saved.capture());
            verify(photoFilesCleaner).deleteQuietly(List.of(saved.getValue().getStorageKey()));
        }

        @Test
        @DisplayName("失敗的上傳要歸還處理名額，否則幾次失敗後所有上傳都會卡住")
        void shouldReleaseSlotOnFailure() {
            when(filmRollRepository.existsById(ROLL_ID)).thenReturn(true);
            when(imageProcessor.process(any())).thenThrow(new InvalidPhotoException("壞檔"));

            // 名額只有 1 個；沒歸還的話第 2 次會等 30 秒後丟 UploadBusyException
            assertTimeoutPreemptively(Duration.ofSeconds(5), () -> {
                for (int i = 0; i < 5; i++) {
                    assertThatThrownBy(() -> photoService.upload(ROLL_ID, file("01.jpg"), null))
                            .isInstanceOf(InvalidPhotoException.class);
                }
            });
        }

        @ParameterizedTest(name = "{0}.jpg 存失敗")
        @ValueSource(strings = {"original", "web", "thumb"})
        @DisplayName("不論哪一個版本存失敗：不寫紀錄、清掉的 key 涵蓋所有嘗試過的 put、原本的例外照丟")
        void shouldCleanUpWhicheverPutFails(String failing) {
            when(filmRollRepository.existsById(ROLL_ID)).thenReturn(true);
            when(imageProcessor.process(any())).thenReturn(PROCESSED);
            IllegalStateException boom = new IllegalStateException("儲存空間掛了");
            lenient().doThrow(boom).when(objectStorage).put(endsWith("/" + failing + ".jpg"), any(), anyString());

            assertThatThrownBy(() -> photoService.upload(ROLL_ID, file("01.jpg"), null)).isSameAs(boom);

            verify(photoRepository, never()).saveAndFlush(any());
            ArgumentCaptor<Collection<String>> cleaned = keysCaptor();
            verify(photoFilesCleaner).deleteQuietly(cleaned.capture());
            ArgumentCaptor<String> putKeys = ArgumentCaptor.forClass(String.class);
            verify(objectStorage, atLeastOnce()).put(putKeys.capture(), any(), anyString());
            String cleanedKey = cleaned.getValue().iterator().next();
            assertThat(putKeys.getAllValues()).isNotEmpty()
                    .allSatisfy(key -> assertThat(key).startsWith(cleanedKey + "/"));
        }

        @Test
        @DisplayName("寫紀錄失敗時，清掉的就是剛存的那三個物件的 key（不是別的）")
        void shouldCleanExactlyTheKeysThatWerePut() {
            when(filmRollRepository.existsById(ROLL_ID)).thenReturn(true);
            when(imageProcessor.process(any())).thenReturn(PROCESSED);
            when(photoRepository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("uq_photo_roll_frame"));

            assertThatThrownBy(() -> photoService.upload(ROLL_ID, file("01.jpg"), null))
                    .isInstanceOf(DataIntegrityViolationException.class);

            ArgumentCaptor<Collection<String>> cleaned = keysCaptor();
            verify(photoFilesCleaner).deleteQuietly(cleaned.capture());
            ArgumentCaptor<String> putKeys = ArgumentCaptor.forClass(String.class);
            verify(objectStorage, times(3)).put(putKeys.capture(), any(), anyString());
            String storageKey = cleaned.getValue().iterator().next();
            assertThat(putKeys.getAllValues()).containsExactlyInAnyOrderElementsOf(Photo.allObjectKeys(storageKey));
        }

        @Test
        @DisplayName("圖片處理失敗（壞檔）：還沒存任何東西，所以不寫紀錄、也不需要清理")
        void shouldTouchNothingWhenProcessingFails() {
            when(filmRollRepository.existsById(ROLL_ID)).thenReturn(true);
            when(imageProcessor.process(any())).thenThrow(new InvalidPhotoException("壞檔"));

            assertThatThrownBy(() -> photoService.upload(ROLL_ID, file("01.jpg"), null))
                    .isInstanceOf(InvalidPhotoException.class)
                    .hasMessage("壞檔");

            verifyNoInteractions(objectStorage, photoFilesCleaner);
            verify(photoRepository, never()).saveAndFlush(any());
        }

        @Test
        @DisplayName("讀不到暫存的上傳檔：伺服器端的問題（UncheckedIOException），不是使用者的錯；名額照樣歸還")
        void shouldWrapIoFailureAndReleaseSlot() throws Exception {
            when(filmRollRepository.existsById(ROLL_ID)).thenReturn(true);
            MultipartFile broken = mock(MultipartFile.class);
            IOException cause = new IOException("tmp file gone");
            when(broken.isEmpty()).thenReturn(false);
            when(broken.getOriginalFilename()).thenReturn("01.jpg");
            when(broken.getBytes()).thenThrow(cause);

            assertTimeoutPreemptively(Duration.ofSeconds(5), () -> {
                for (int i = 0; i < 3; i++) {
                    assertThatThrownBy(() -> photoService.upload(ROLL_ID, broken, 1))
                            .isInstanceOf(UncheckedIOException.class)
                            .hasCause(cause);
                }
            });
            verifyNoInteractions(imageProcessor, objectStorage, photoFilesCleaner);
        }

        @Test
        @DisplayName("上傳名額只有一個：同時進來的上傳不會同時處理圖片（解碼一張大圖要 200 MB heap）")
        void shouldProcessOneUploadAtATime() throws Exception {
            when(filmRollRepository.existsById(ROLL_ID)).thenReturn(true);

            assertThat(maxConcurrentProcessing(4)).isEqualTo(1);
        }

        @Test
        @DisplayName("等名額時被中斷：回 UploadBusyException、保留中斷旗標，而且不能多還一個名額")
        void shouldKeepInterruptFlagAndNotInflatePermits() throws Exception {
            when(filmRollRepository.existsById(ROLL_ID)).thenReturn(true);

            Thread.currentThread().interrupt();
            try {
                assertThatThrownBy(() -> photoService.upload(ROLL_ID, file("01.jpg"), 1))
                        .isInstanceOf(UploadBusyException.class);
                assertThat(Thread.currentThread().isInterrupted()).as("中斷旗標要保留給呼叫端").isTrue();
            } finally {
                Thread.interrupted(); // 清掉旗標，免得影響後面的測試
            }
            verifyNoInteractions(imageProcessor, objectStorage);

            // 沒拿到名額的人若在 finally 裡多還了一個，名額會變成 2，就同時處理兩張了
            assertThat(maxConcurrentProcessing(4)).isEqualTo(1);
        }

        /** 同時送出 {@code threads} 個上傳，回傳 ImageProcessor 同一時間最多被幾個執行緒使用。 */
        private int maxConcurrentProcessing(int threads) throws Exception {
            AtomicInteger running = new AtomicInteger();
            AtomicInteger peak = new AtomicInteger();
            when(imageProcessor.process(any())).thenAnswer(inv -> {
                peak.accumulateAndGet(running.incrementAndGet(), Math::max);
                Thread.sleep(60);
                running.decrementAndGet();
                return PROCESSED;
            });
            when(photoRepository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

            ExecutorService pool = Executors.newFixedThreadPool(threads);
            try {
                CountDownLatch go = new CountDownLatch(1);
                List<Future<?>> results = new ArrayList<>();
                for (int i = 0; i < threads; i++) {
                    int frame = i;
                    results.add(pool.submit(() -> {
                        go.await();
                        return photoService.upload(ROLL_ID, file("scan.jpg"), frame);
                    }));
                }
                go.countDown();
                for (Future<?> result : results) {
                    result.get(10, TimeUnit.SECONDS); // 任何一個失敗（或卡住）都讓測試失敗
                }
            } finally {
                pool.shutdownNow();
            }
            return peak.get();
        }

        @SuppressWarnings("unchecked")
        private ArgumentCaptor<Collection<String>> keysCaptor() {
            return ArgumentCaptor.forClass(Collection.class);
        }

        @SuppressWarnings("unchecked")
        private void assertCleanedUpKeyUnderRoll() {
            ArgumentCaptor<Collection<String>> keys = ArgumentCaptor.forClass(Collection.class);
            verify(photoFilesCleaner).deleteQuietly(keys.capture());
            assertThat(keys.getValue()).singleElement().asString().startsWith("rolls/" + ROLL_ID + "/");
        }
    }

    @Nested
    @DisplayName("讀取與刪除")
    class ReadAndDelete {

        @Test
        @DisplayName("資料庫有紀錄但檔案不見了 → 對外是 404，不是 500")
        void shouldTranslateMissingObjectToNotFound() {
            Photo photo = Photo.create(ROLL_ID, 1, "rolls/7/abc", "01.jpg", 30, 20, 100);
            when(photoRepository.findById(1L)).thenReturn(Optional.of(photo));
            when(objectStorage.get("rolls/7/abc/thumb.jpg")).thenThrow(new StoredObjectNotFoundException("rolls/7/abc/thumb.jpg"));

            assertThatThrownBy(() -> photoService.openContent(1L, PhotoVariant.THUMB))
                    .isInstanceOf(PhotoNotFoundException.class);
        }

        @Test
        @DisplayName("刪除照片：刪紀錄並發出清檔事件（檔案等交易提交後才刪）")
        void shouldPublishCleanupOnDelete() {
            Photo photo = Photo.create(ROLL_ID, 1, "rolls/7/abc", "01.jpg", 30, 20, 100);
            when(photoRepository.findById(1L)).thenReturn(Optional.of(photo));

            photoService.delete(1L);

            verify(photoRepository).delete(photo);
            verify(eventPublisher).publishEvent(new PhotoFilesOrphanedEvent(List.of("rolls/7/abc")));
            verifyNoInteractions(objectStorage);
        }

        @Test
        @DisplayName("刪除不存在的照片 → 404，不發事件")
        void shouldRejectMissingPhotoOnDelete() {
            when(photoRepository.findById(anyLong())).thenReturn(Optional.empty());

            assertThatThrownBy(() -> photoService.delete(9L)).isInstanceOf(PhotoNotFoundException.class);
            verifyNoInteractions(eventPublisher);
        }

        @Test
        @DisplayName("刪卷期：有照片才發清檔事件")
        void shouldPublishCleanupForRollOnlyWhenItHasPhotos() {
            when(photoRepository.findStorageKeysByFilmRollId(ROLL_ID)).thenReturn(List.of());
            photoService.cleanUpFilesOfRoll(ROLL_ID);
            verifyNoInteractions(eventPublisher);

            when(photoRepository.findStorageKeysByFilmRollId(ROLL_ID)).thenReturn(List.of("rolls/7/a", "rolls/7/b"));
            photoService.cleanUpFilesOfRoll(ROLL_ID);
            verify(eventPublisher).publishEvent(new PhotoFilesOrphanedEvent(List.of("rolls/7/a", "rolls/7/b")));
        }
    }

    @Test
    @DisplayName("清檔：每張照片展開成三個版本的物件 key")
    void cleanerShouldExpandAllVariants() {
        PhotoFilesCleaner cleaner = new PhotoFilesCleaner(objectStorage);

        cleaner.deleteQuietly(List.of("rolls/7/a"));

        verify(objectStorage).deleteAll(List.of(
                "rolls/7/a/thumb.jpg", "rolls/7/a/web.jpg", "rolls/7/a/original.jpg"));
    }

    @Test
    @DisplayName("清檔事件監聽器：收到事件就刪掉事件裡每張照片的三個版本")
    void cleanerListenerShouldDeleteEveryPhotoInEvent() {
        PhotoFilesCleaner cleaner = new PhotoFilesCleaner(objectStorage);

        cleaner.onPhotoFilesOrphaned(new PhotoFilesOrphanedEvent(List.of("rolls/7/a", "rolls/7/b")));

        verify(objectStorage).deleteAll(List.of(
                "rolls/7/a/thumb.jpg", "rolls/7/a/web.jpg", "rolls/7/a/original.jpg",
                "rolls/7/b/thumb.jpg", "rolls/7/b/web.jpg", "rolls/7/b/original.jpg"));
    }

    @Test
    @DisplayName("清檔失敗不往外丟：使用者的刪除已經成功了")
    void cleanerShouldSwallowStorageFailure() {
        PhotoFilesCleaner cleaner = new PhotoFilesCleaner(objectStorage);
        doThrow(new IllegalStateException("網路斷了")).when(objectStorage).deleteAll(any());

        // 沒丟例外就是通過；再確認真的有嘗試刪
        cleaner.deleteQuietly(List.of("rolls/7/a"));

        verify(objectStorage).deleteAll(any());
    }
}
