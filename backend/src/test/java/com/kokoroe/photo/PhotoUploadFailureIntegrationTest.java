package com.kokoroe.photo;

import com.kokoroe.TestcontainersConfiguration;
import com.kokoroe.storage.ObjectStorage;
import com.kokoroe.storage.StoredObjectNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.endsWith;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 上傳途中出事的真實情況：用真的 PostgreSQL 與 RustFS，只在 {@link ObjectStorage} 外面包一層 spy 來注入故障。
 *
 * <p>單元測試用 mock 驗證過「有呼叫清理」，這裡驗證「清理之後儲存空間裡真的沒有留下檔案」，
 * 以及真實的唯一約束與競態。spy bean 會讓這個類別使用獨立的 Spring context（多啟動一組容器）。
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@DisplayName("上傳失敗與競態的補償（真實資料庫與儲存空間）")
class PhotoUploadFailureIntegrationTest {

    private static final byte[] LANDSCAPE = TestImages.jpeg(1200, 800);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PhotoRepository photoRepository;

    @MockitoSpyBean
    private ObjectStorage objectStorage;

    private long rollId;

    @BeforeEach
    void createRoll() throws Exception {
        String created = mockMvc.perform(post("/api/v1/film-rolls")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "filmName": "Kodak Tri-X 400",
                                  "brand": "Kodak",
                                  "iso": 400,
                                  "format": "135",
                                  "pushPullStops": 0,
                                  "loadedAt": "2026-03-01"
                                }
                                """))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        rollId = objectMapper.readTree(created).get("id").asLong();
    }

    private static MockMultipartFile jpegFile() {
        return new MockMultipartFile("file", "scan.jpg", MediaType.IMAGE_JPEG_VALUE, LANDSCAPE);
    }

    /** 這次測試裡 put 過的所有物件 key（含失敗的那次）。 */
    private List<String> attemptedPutKeys(int atLeast) {
        ArgumentCaptor<String> keys = ArgumentCaptor.forClass(String.class);
        verify(objectStorage, atLeast(atLeast)).put(keys.capture(), any(), anyString());
        return keys.getAllValues();
    }

    private void assertGone(String key) {
        assertThatThrownBy(() -> objectStorage.get(key))
                .as("%s 不該留在儲存空間裡", key)
                .isInstanceOf(StoredObjectNotFoundException.class);
    }

    @Test
    @DisplayName("寫紀錄時輸給別的請求（唯一約束）：409，輸家存好的三個檔案都被清掉，贏家的紀錄完好")
    void shouldCleanUpFilesWhenInsertLosesTheRace() throws Exception {
        // 原圖存好之後、寫紀錄之前，另一個請求搶先把第 7 格寫進去
        doAnswer(invocation -> {
            Object result = invocation.callRealMethod();
            if (((String) invocation.getArgument(0)).endsWith("/original.jpg")) {
                photoRepository.saveAndFlush(
                        Photo.create(rollId, 7, "rolls/%d/rival".formatted(rollId), "rival.jpg", 10, 10, 10));
            }
            return result;
        }).when(objectStorage).put(anyString(), any(), anyString());

        mockMvc.perform(multipart("/api/v1/film-rolls/{id}/photos", rollId).file(jpegFile()).param("frameNumber", "7"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.detail").value(not(containsString("uq_photo_roll_frame"))));

        assertThat(photoRepository.findStorageKeysByFilmRollId(rollId)).containsExactly("rolls/%d/rival".formatted(rollId));
        List<String> keys = attemptedPutKeys(3);
        assertThat(keys).hasSize(3);
        keys.forEach(this::assertGone);
    }

    @Test
    @DisplayName("第三個版本存失敗：500 通用訊息、沒有紀錄，前兩個已存的檔案被清掉；之後的上傳照常成功")
    void shouldCleanUpWhenLastPutFails() throws Exception {
        doThrow(new IllegalStateException("s3 backend exploded password=hunter2"))
                .when(objectStorage).put(endsWith("/thumb.jpg"), any(), anyString());

        mockMvc.perform(multipart("/api/v1/film-rolls/{id}/photos", rollId).file(jpegFile()))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.type").value("urn:kokoroe:problem:internal-error"))
                .andExpect(jsonPath("$.detail").value(not(containsString("hunter2"))));

        assertThat(photoRepository.findStorageKeysByFilmRollId(rollId)).isEmpty();
        List<String> keys = attemptedPutKeys(3);
        assertThat(keys).hasSize(3);
        keys.forEach(this::assertGone);

        // 名額有歸還、故障排除後同一格可以再傳
        Mockito.reset(objectStorage);
        mockMvc.perform(multipart("/api/v1/film-rolls/{id}/photos", rollId).file(jpegFile()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.frameNumber").value(1));
    }

    @Test
    @DisplayName("補償清理本身也失敗：client 仍看到最初的錯誤，不被清理的錯誤蓋掉")
    void shouldReportOriginalErrorWhenCleanupAlsoFails() throws Exception {
        doThrow(new IllegalStateException("put failed")).when(objectStorage).put(endsWith("/web.jpg"), any(), anyString());
        doThrow(new IllegalStateException("cleanup boom")).when(objectStorage).deleteAll(anyCollection());

        mockMvc.perform(multipart("/api/v1/film-rolls/{id}/photos", rollId).file(jpegFile()))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.detail").value(not(containsString("cleanup boom"))));

        assertThat(photoRepository.findStorageKeysByFilmRollId(rollId)).isEmpty();
        verify(objectStorage, times(1)).deleteAll(anyCollection());
    }

    @Test
    @DisplayName("刪除照片時清檔失敗：使用者的刪除仍然成功（204），紀錄已刪")
    void shouldStillDeletePhotoWhenFileCleanupFails() throws Exception {
        String body = mockMvc.perform(multipart("/api/v1/film-rolls/{id}/photos", rollId).file(jpegFile()))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = objectMapper.readTree(body).get("id").asLong();
        doThrow(new IllegalStateException("cleanup boom")).when(objectStorage).deleteAll(anyCollection());

        mockMvc.perform(delete("/api/v1/photos/{id}", id)).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/photos/{id}", id)).andExpect(status().isNotFound());
        verify(objectStorage).deleteAll(anyCollection());
    }

    @Test
    @DisplayName("四個請求同時搶同一格：恰好一個 201、其餘 409；只剩贏家的紀錄與三個檔案，輸家的檔案全清掉")
    void shouldLetExactlyOneConcurrentUploadWin() throws Exception {
        int threads = 4;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        List<Integer> statuses = new ArrayList<>();
        try {
            CountDownLatch go = new CountDownLatch(1);
            List<Future<Integer>> results = new ArrayList<>();
            for (int i = 0; i < threads; i++) {
                Callable<Integer> upload = () -> {
                    go.await();
                    return mockMvc.perform(multipart("/api/v1/film-rolls/{id}/photos", rollId)
                                    .file(jpegFile()).param("frameNumber", "3"))
                            .andReturn().getResponse().getStatus();
                };
                results.add(pool.submit(upload));
            }
            go.countDown();
            for (Future<Integer> result : results) {
                statuses.add(result.get(60, TimeUnit.SECONDS));
            }
        } finally {
            pool.shutdownNow();
        }

        assertThat(statuses).containsExactlyInAnyOrder(201, 409, 409, 409);
        List<String> stored = photoRepository.findStorageKeysByFilmRollId(rollId);
        assertThat(stored).hasSize(1);
        List<String> winnerKeys = Photo.allObjectKeys(stored.getFirst());
        // 贏家的檔案都在；其他所有 put 過的 key（輸家的）都被清掉了
        winnerKeys.forEach(key -> assertThat(objectStorage.get(key)).isNotNull());
        List<String> attempted = attemptedPutKeys(3);
        assertThat(attempted).containsAll(winnerKeys);
        attempted.stream().filter(key -> !winnerKeys.contains(key)).forEach(this::assertGone);
    }
}
