package com.kokoroe.photo;

import com.kokoroe.TestcontainersConfiguration;
import com.kokoroe.filmroll.FilmRollService;
import com.kokoroe.storage.ObjectStorage;
import com.kokoroe.storage.StoredObject;
import com.kokoroe.storage.StoredObjectNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.awt.image.BufferedImage;
import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 照片端到端整合測試：真的 PostgreSQL、真的 RustFS，從 HTTP 一路到儲存空間。
 *
 * <p>類別上的註解與其他整合測試相同，共用同一個 Spring context 與容器。
 * 每個測試自己建一卷新的，彼此的格號不會互相干擾。
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@DisplayName("Photo 端到端整合測試")
class PhotoIntegrationTest {

    private static final byte[] LANDSCAPE = TestImages.jpeg(1200, 800);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PhotoRepository photoRepository;

    @Autowired
    private ObjectStorage objectStorage;

    private long rollId;

    @Autowired
    private PhotoService photoService;

    @Autowired
    private FilmRollService filmRollService;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @BeforeEach
    void setUpRoll() throws Exception {
        rollId = createRoll();
    }

    private long createRoll() throws Exception {
        String created = mockMvc.perform(post("/api/v1/film-rolls")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "filmName": "Ilford HP5 Plus",
                                  "brand": "Ilford",
                                  "iso": 400,
                                  "format": "135",
                                  "pushPullStops": 0,
                                  "loadedAt": "2026-03-01"
                                }
                                """))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(created).get("id").asLong();
    }

    private static MockMultipartFile jpegFile(String filename, byte[] content) {
        return new MockMultipartFile("file", filename, MediaType.IMAGE_JPEG_VALUE, content);
    }

    private JsonNode upload(MockMultipartFile file) throws Exception {
        return upload(rollId, file);
    }

    private JsonNode upload(long targetRollId, MockMultipartFile file) throws Exception {
        String body = mockMvc.perform(multipart("/api/v1/film-rolls/{id}/photos", targetRollId).file(file))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body);
    }

    private String storageKeyOf(JsonNode photo) {
        return photoRepository.findById(photo.get("id").asLong()).orElseThrow().getStorageKey();
    }

    private void assertObjectsGone(String storageKey) {
        for (String key : Photo.allObjectKeys(storageKey)) {
            assertThatThrownBy(() -> objectStorage.get(key))
                    .as("儲存空間裡的 %s 應該已被刪除", key)
                    .isInstanceOf(StoredObjectNotFoundException.class);
        }
    }

    private void assertObjectsExist(String storageKey) throws Exception {
        for (String key : Photo.allObjectKeys(storageKey)) {
            try (StoredObject object = objectStorage.get(key)) {
                assertThat(object.contentLength()).as(key).isPositive();
            }
        }
    }

    @Test
    @DisplayName("上傳 → 格號規則 → 列表 → 讀三個版本 → 刪除照片 → 檔案一起刪掉")
    void shouldSupportPhotoLifecycle() throws Exception {
        // --- 上傳：格號從檔名來 ------------------------------------------
        String location = mockMvc.perform(multipart("/api/v1/film-rolls/{id}/photos", rollId)
                        .file(jpegFile("000123_01.jpg", LANDSCAPE)))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, containsString("/api/v1/photos/")))
                .andExpect(jsonPath("$.filmRollId").value(rollId))
                .andExpect(jsonPath("$.frameNumber").value(1))
                .andExpect(jsonPath("$.originalFilename").value("000123_01.jpg"))
                .andExpect(jsonPath("$.width").value(1200))
                .andExpect(jsonPath("$.height").value(800))
                .andExpect(jsonPath("$.sizeBytes").value(LANDSCAPE.length))
                .andExpect(jsonPath("$.storageKey").doesNotExist())
                .andReturn().getResponse().getHeader(HttpHeaders.LOCATION);
        long firstId = Long.parseLong(location.substring(location.lastIndexOf('/') + 1));

        // --- 檔名推不出格號 → 接在最大格號後面 ---------------------------
        assertThat(upload(jpegFile("scan.jpg", LANDSCAPE)).get("frameNumber").asInt()).isEqualTo(2);

        // --- 明確指定第 0 格 --------------------------------------------
        mockMvc.perform(multipart("/api/v1/film-rolls/{id}/photos", rollId)
                        .file(jpegFile("scan.jpg", LANDSCAPE))
                        .param("frameNumber", "0"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.frameNumber").value(0));

        // --- 同一格再傳一次 → 409，而且沒有留下多的紀錄 -------------------
        mockMvc.perform(multipart("/api/v1/film-rolls/{id}/photos", rollId)
                        .file(jpegFile("000123_01.jpg", LANDSCAPE)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(containsString("第 1 格")));

        // --- 列表依格號排序 ----------------------------------------------
        mockMvc.perform(get("/api/v1/film-rolls/{id}/photos", rollId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].frameNumber").value(0))
                .andExpect(jsonPath("$[1].frameNumber").value(1))
                .andExpect(jsonPath("$[2].frameNumber").value(2));

        // --- 縮圖：JPEG、長邊 480、可長期快取 -----------------------------
        byte[] thumb = mockMvc.perform(get("/api/v1/photos/{id}/thumb", firstId))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, MediaType.IMAGE_JPEG_VALUE))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("immutable")))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("private")))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andReturn().getResponse().getContentAsByteArray();
        BufferedImage thumbImage = TestImages.decode(thumb);
        assertThat(thumbImage.getWidth()).isEqualTo(480);
        assertThat(thumbImage.getHeight()).isEqualTo(320);

        // --- 網頁版：原圖比 2048 小，不放大 --------------------------------
        byte[] web = mockMvc.perform(get("/api/v1/photos/{id}/web", firstId))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(TestImages.decode(web).getWidth()).isEqualTo(1200);

        // --- 原圖：一個 byte 都沒變 ---------------------------------------
        byte[] original = mockMvc.perform(get("/api/v1/photos/{id}/original", firstId))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(original).isEqualTo(LANDSCAPE);

        // --- 刪除照片 → 紀錄與三個檔案都不見 -------------------------------
        String storageKey = photoRepository.findById(firstId).orElseThrow().getStorageKey();
        assertObjectsExist(storageKey);

        mockMvc.perform(delete("/api/v1/photos/{id}", firstId))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/photos/{id}", firstId)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/photos/{id}/thumb", firstId)).andExpect(status().isNotFound());
        assertObjectsGone(storageKey);

        // --- 刪掉之後那一格可以重傳 ---------------------------------------
        assertThat(upload(jpegFile("000123_01.jpg", LANDSCAPE)).get("frameNumber").asInt()).isEqualTo(1);
    }

    @Test
    @DisplayName("刪除卷期：照片紀錄由 CASCADE 刪掉，儲存空間的檔案也一起清掉")
    void shouldDeletePhotosWithRoll() throws Exception {
        upload(jpegFile("01.jpg", LANDSCAPE));
        upload(jpegFile("02.jpg", LANDSCAPE));
        var storageKeys = photoRepository.findStorageKeysByFilmRollId(rollId);
        assertThat(storageKeys).hasSize(2);

        mockMvc.perform(delete("/api/v1/film-rolls/{id}", rollId))
                .andExpect(status().isNoContent());

        assertThat(photoRepository.findByFilmRollIdOrderByFrameNumberAsc(rollId)).isEmpty();
        storageKeys.forEach(this::assertObjectsGone);
    }

    @Test
    @DisplayName("不合法的上傳：不是 JPEG、空檔、沒有 file 欄位、不是 multipart、格號超出範圍")
    void shouldRejectInvalidUploads() throws Exception {
        String url = "/api/v1/film-rolls/{id}/photos";

        // 副檔名與 Content-Type 都說是 JPEG，內容其實是 PNG
        mockMvc.perform(multipart(url, rollId).file(jpegFile("01.jpg", TestImages.png(100, 100))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(containsString("JPEG")));

        mockMvc.perform(multipart(url, rollId).file(jpegFile("01.jpg", new byte[0])))
                .andExpect(status().isBadRequest());

        mockMvc.perform(multipart(url, rollId).file(new MockMultipartFile("photo", "01.jpg", "image/jpeg", LANDSCAPE)))
                .andExpect(status().isBadRequest());

        // Spring 的標準例外（415）不能被兜底 handler 變成 500
        mockMvc.perform(post(url, rollId).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnsupportedMediaType());

        mockMvc.perform(multipart(url, rollId).file(jpegFile("01.jpg", LANDSCAPE)).param("frameNumber", "100"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(multipart(url, rollId).file(jpegFile("01.jpg", LANDSCAPE)).param("frameNumber", "abc"))
                .andExpect(status().isBadRequest());

        // 全部被拒，一張都沒存進去
        assertThat(photoRepository.findStorageKeysByFilmRollId(rollId)).isEmpty();
    }

    @Test
    @DisplayName("不存在的卷期、照片、版本")
    void shouldReturnNotFoundOrBadRequest() throws Exception {
        long missing = Long.MAX_VALUE;

        mockMvc.perform(get("/api/v1/film-rolls/{id}/photos", missing))
                .andExpect(status().isNotFound());
        mockMvc.perform(multipart("/api/v1/film-rolls/{id}/photos", missing).file(jpegFile("01.jpg", LANDSCAPE)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/photos/{id}/thumb", missing))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/v1/photos/{id}", missing))
                .andExpect(status().isNotFound());

        long id = upload(jpegFile("01.jpg", LANDSCAPE)).get("id").asLong();
        mockMvc.perform(get("/api/v1/photos/{id}/large", id))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Spring 標準例外保留原本的狀態碼：405 不能變成 500")
    void shouldKeepStandardErrorStatus() throws Exception {
        mockMvc.perform(post("/api/v1/photos/{id}", 1))
                .andExpect(status().isMethodNotAllowed())
                // RFC 9110：405 必須告訴 client 哪些方法可以用
                .andExpect(header().string(HttpHeaders.ALLOW, containsString("GET")))
                .andExpect(header().string(HttpHeaders.ALLOW, containsString("DELETE")))
                .andExpect(header().string(HttpHeaders.ALLOW, not(containsString("POST"))))
                .andExpect(jsonPath("$.status").value(405));
    }

    // ---------------------------------------------------------------------
    // 以下是對抗式審查補上的案例
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("沒有照片的卷期：列表是 200 與空陣列")
    void shouldListEmptyRoll() throws Exception {
        mockMvc.perform(get("/api/v1/film-rolls/{id}/photos", rollId))
                .andExpect(status().isOk())
                .andExpect(content().string("[]"));
    }

    @Test
    @DisplayName("單張查詢與列表回傳的欄位都對，createdAt 是剛才的時間")
    void shouldReturnPhotoMetadata() throws Exception {
        Instant before = Instant.now().minusSeconds(5);
        JsonNode created = upload(jpegFile("000123_07.jpg", LANDSCAPE));
        long id = created.get("id").asLong();

        mockMvc.perform(get("/api/v1/photos/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.filmRollId").value(rollId))
                .andExpect(jsonPath("$.frameNumber").value(7))
                .andExpect(jsonPath("$.originalFilename").value("000123_07.jpg"))
                .andExpect(jsonPath("$.width").value(1200))
                .andExpect(jsonPath("$.height").value(800))
                .andExpect(jsonPath("$.sizeBytes").value(LANDSCAPE.length))
                .andExpect(jsonPath("$.storageKey").doesNotExist());
        mockMvc.perform(get("/api/v1/film-rolls/{id}/photos", rollId))
                .andExpect(jsonPath("$[0].id").value(id))
                .andExpect(jsonPath("$[0].frameNumber").value(7))
                .andExpect(jsonPath("$[0].originalFilename").value("000123_07.jpg"))
                .andExpect(jsonPath("$[0].width").value(1200))
                .andExpect(jsonPath("$[0].sizeBytes").value(LANDSCAPE.length));

        Instant createdAt = Instant.parse(created.get("createdAt").asText());
        assertThat(createdAt).isBetween(before, Instant.now().plusSeconds(5));
    }

    @Test
    @DisplayName("格號邊界：第 99 格收；100 與 -1 拒絕；指定的格號重複也是 409")
    void shouldEnforceFrameBoundariesEndToEnd() throws Exception {
        String url = "/api/v1/film-rolls/{id}/photos";

        mockMvc.perform(multipart(url, rollId).file(jpegFile("a.jpg", LANDSCAPE)).param("frameNumber", "99"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.frameNumber").value(99));
        mockMvc.perform(multipart(url, rollId).file(jpegFile("a.jpg", LANDSCAPE)).param("frameNumber", "100"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(containsString("0 到 99")));
        mockMvc.perform(multipart(url, rollId).file(jpegFile("a.jpg", LANDSCAPE)).param("frameNumber", "-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(containsString("0 到 99")));
        // 這卷已經用到第 99 格，沒指定格號的上傳沒有下一格可接
        mockMvc.perform(multipart(url, rollId).file(jpegFile("scan.jpg", LANDSCAPE)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(containsString("沒有空的格號")));
        // 明確指定的格號被佔用 → 409（檔名那條路徑的 409 已在生命週期測試）
        mockMvc.perform(multipart(url, rollId).file(jpegFile("a.jpg", LANDSCAPE)).param("frameNumber", "99"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(containsString("第 99 格")));

        assertThat(photoRepository.findStorageKeysByFilmRollId(rollId)).hasSize(1);
    }

    @Test
    @DisplayName("格號的唯一性與「接在最大格號後面」都只看同一卷：別卷的格號不干擾")
    void shouldScopeFramesToTheirOwnRoll() throws Exception {
        long otherRoll = createRoll();
        upload(rollId, jpegFile("01.jpg", LANDSCAPE));
        upload(rollId, jpegFile("02.jpg", LANDSCAPE));

        // 另一卷的第 1 格不算重複
        assertThat(upload(otherRoll, jpegFile("01.jpg", LANDSCAPE)).get("frameNumber").asInt()).isEqualTo(1);
        // 另一卷接在自己的最大格號後面（2），不是這卷的
        assertThat(upload(otherRoll, jpegFile("scan.jpg", LANDSCAPE)).get("frameNumber").asInt()).isEqualTo(2);

        mockMvc.perform(get("/api/v1/film-rolls/{id}/photos", otherRoll))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].filmRollId").value(otherRoll))
                .andExpect(jsonPath("$[1].filmRollId").value(otherRoll));
    }

    @Test
    @DisplayName("刪除一卷只清那一卷的檔案；刪除一張只清那一張的檔案")
    void shouldOnlyDeleteOwnFiles() throws Exception {
        long otherRoll = createRoll();
        JsonNode mine1 = upload(rollId, jpegFile("01.jpg", LANDSCAPE));
        JsonNode mine2 = upload(rollId, jpegFile("02.jpg", LANDSCAPE));
        JsonNode theirs = upload(otherRoll, jpegFile("01.jpg", LANDSCAPE));
        String key1 = storageKeyOf(mine1);
        String key2 = storageKeyOf(mine2);
        String theirKey = storageKeyOf(theirs);

        // 刪一張：同一卷的另一張完好
        mockMvc.perform(delete("/api/v1/photos/{id}", mine1.get("id").asLong())).andExpect(status().isNoContent());
        assertObjectsGone(key1);
        assertObjectsExist(key2);
        assertObjectsExist(theirKey);

        // 刪一卷：別卷的照片與檔案完好
        mockMvc.perform(delete("/api/v1/film-rolls/{id}", rollId)).andExpect(status().isNoContent());
        assertObjectsGone(key2);
        assertObjectsExist(theirKey);
        mockMvc.perform(get("/api/v1/photos/{id}/thumb", theirs.get("id").asLong())).andExpect(status().isOk());
    }

    @Test
    @DisplayName("EXIF 方向 6 的照片：回報轉正後的寬高 800×1200；原檔連 EXIF 一個 byte 都沒變，網頁版與縮圖已轉正且不帶 EXIF")
    void shouldHonorExifOrientationEndToEnd() throws Exception {
        byte[] exif = TestImages.withExifOrientation(TestImages.jpeg(1200, 800), 6);
        JsonNode created = upload(jpegFile("scan_03.jpg", exif));
        long id = created.get("id").asLong();

        assertThat(created.get("width").asInt()).isEqualTo(800);
        assertThat(created.get("height").asInt()).isEqualTo(1200);
        assertThat(created.get("sizeBytes").asLong()).isEqualTo(exif.length);

        byte[] original = mockMvc.perform(get("/api/v1/photos/{id}/original", id))
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(original).isEqualTo(exif);

        byte[] web = mockMvc.perform(get("/api/v1/photos/{id}/web", id))
                .andReturn().getResponse().getContentAsByteArray();
        BufferedImage webImage = TestImages.decode(web);
        assertThat(webImage.getWidth()).isEqualTo(800);
        assertThat(webImage.getHeight()).isEqualTo(1200);
        assertThat(new String(web, java.nio.charset.StandardCharsets.ISO_8859_1)).doesNotContain("Exif");

        byte[] thumb = mockMvc.perform(get("/api/v1/photos/{id}/thumb", id))
                .andReturn().getResponse().getContentAsByteArray();
        BufferedImage thumbImage = TestImages.decode(thumb);
        assertThat(thumbImage.getHeight()).isEqualTo(480);
        assertThat(thumbImage.getWidth()).isEqualTo(320);
    }

    @Test
    @DisplayName("惡意或超長的檔名：只存乾淨的檔名、路徑穿越無效、超過欄位長度不會變 500")
    void shouldSanitizeHostileFilenames() throws Exception {
        String url = "/api/v1/film-rolls/{id}/photos";

        // 路徑穿越：只剩 05.jpg，格號 5；儲存空間的 key 與檔名完全無關
        MockMultipartFile traversal = jpegFile("..\\..\\evil/../05.jpg", LANDSCAPE);
        JsonNode first = upload(traversal);
        assertThat(first.get("originalFilename").asText()).isEqualTo("05.jpg");
        assertThat(first.get("frameNumber").asInt()).isEqualTo(5);
        assertThat(storageKeyOf(first)).matches("rolls/" + rollId + "/[0-9a-f-]{36}");

        // 控制字元與中文
        JsonNode chinese = upload(jpegFile("底片\r\n_08.jpg", LANDSCAPE));
        assertThat(chinese.get("originalFilename").asText()).isEqualTo("底片_08.jpg");
        assertThat(chinese.get("frameNumber").asInt()).isEqualTo(8);

        // 300 個字元的檔名：截成 255 才寫得進 VARCHAR(255)
        String longName = "a".repeat(300) + ".jpg";
        String longBody = mockMvc.perform(multipart(url, rollId).file(jpegFile(longName, LANDSCAPE))
                        .param("frameNumber", "1"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        assertThat(objectMapper.readTree(longBody).get("originalFilename").asText()).isEqualTo("a".repeat(255));

        // 300 個 emoji：不能從代理對中間切開
        String emojiBody = mockMvc.perform(multipart(url, rollId).file(jpegFile("📷".repeat(300), LANDSCAPE))
                        .param("frameNumber", "2"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String emojiName = objectMapper.readTree(emojiBody).get("originalFilename").asText();
        assertThat(emojiName).isEqualTo("📷".repeat(255));
    }

    @Test
    @DisplayName("資料庫有紀錄、儲存空間的檔案卻不見了：圖檔 404（含說明），中繼資料仍可查，仍可刪除")
    void shouldReturnNotFoundWhenObjectsAreMissing() throws Exception {
        JsonNode created = upload(jpegFile("01.jpg", LANDSCAPE));
        long id = created.get("id").asLong();
        objectStorage.deleteAll(Photo.allObjectKeys(storageKeyOf(created)));

        for (String variant : new String[]{"thumb", "web", "original"}) {
            mockMvc.perform(get("/api/v1/photos/{id}/{variant}", id, variant))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.detail").value(containsString(String.valueOf(id))));
        }
        mockMvc.perform(get("/api/v1/photos/{id}", id)).andExpect(status().isOk());
        // 檔案已經不在了，刪除仍要成功（不存在的 key 視為已刪除）
        mockMvc.perform(delete("/api/v1/photos/{id}", id)).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/photos/{id}", id)).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("原圖的回應標頭：JPEG、長度等於實際位元組數、一年私有快取、nosniff、sandbox CSP")
    void shouldServeOriginalWithSafeHeaders() throws Exception {
        long id = upload(jpegFile("01.jpg", LANDSCAPE)).get("id").asLong();

        mockMvc.perform(get("/api/v1/photos/{id}/original", id))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, MediaType.IMAGE_JPEG_VALUE))
                .andExpect(header().longValue(HttpHeaders.CONTENT_LENGTH, LANDSCAPE.length))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "max-age=31536000, private, immutable"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Content-Security-Policy", "default-src 'none'; sandbox"));
    }

    @Test
    @DisplayName("連續讀 150 次圖檔都成功：串流有關閉，沒有把連線池耗盡")
    void shouldNotLeakStorageConnections() throws Exception {
        long id = upload(jpegFile("01.jpg", LANDSCAPE)).get("id").asLong();

        // AWS SDK 預設連線池 50 條；漏連線的話第 51 次起會卡住並逾時
        assertTimeoutPreemptively(Duration.ofSeconds(60), () -> {
            for (int i = 0; i < 150; i++) {
                mockMvc.perform(get("/api/v1/photos/{id}/thumb", id)).andExpect(status().isOk());
            }
        });
    }

    @Test
    @DisplayName("刪除照片的交易 rollback：紀錄還在，儲存空間的檔案也還在（檔案要等 commit 之後才刪）")
    void shouldKeepFilesWhenPhotoDeletionRollsBack() throws Exception {
        JsonNode created = upload(jpegFile("01.jpg", LANDSCAPE));
        long id = created.get("id").asLong();
        String key = storageKeyOf(created);

        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            photoService.delete(id);
            status.setRollbackOnly();
        });

        mockMvc.perform(get("/api/v1/photos/{id}", id)).andExpect(status().isOk());
        assertObjectsExist(key);
        // 對照組：commit 的話檔案就會被清掉（見生命週期測試）
    }

    @Test
    @DisplayName("刪除卷期的交易 rollback：卷期、照片、檔案都還在")
    void shouldKeepFilesWhenRollDeletionRollsBack() throws Exception {
        JsonNode created = upload(jpegFile("01.jpg", LANDSCAPE));
        String key = storageKeyOf(created);

        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            filmRollService.delete(rollId);
            status.setRollbackOnly();
        });

        mockMvc.perform(get("/api/v1/film-rolls/{id}", rollId)).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/film-rolls/{id}/photos", rollId))
                .andExpect(jsonPath("$.length()").value(1));
        assertObjectsExist(key);
    }
}
