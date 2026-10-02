package com.kokoroe.photo;

import com.kokoroe.common.GlobalExceptionHandler;
import com.kokoroe.filmroll.FilmRollNotFoundException;
import com.kokoroe.photo.dto.PhotoResponse;
import com.kokoroe.storage.StoredObject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Web 層切片測試：Service 用 mock 取代，驗證 HTTP 契約——狀態碼、ProblemDetail 的欄位、標頭、
 * 以及各種例外有沒有被對到正確的狀態碼。商業邏輯在 {@link PhotoServiceTest}，端到端在 {@link PhotoIntegrationTest}。
 */
@WebMvcTest(PhotoController.class)
@Import(GlobalExceptionHandler.class)
@DisplayName("PhotoController HTTP 契約")
class PhotoControllerTest {

    private static final byte[] JPEG_BYTES = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 1, 2, 3};
    private static final String UPLOAD_URL = "/api/v1/film-rolls/{id}/photos";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PhotoService photoService;

    private static PhotoResponse sample(long id, int frame) {
        return new PhotoResponse(id, 7L, frame, "01.jpg", 1200, 800, 4321L,
                Instant.parse("2026-03-01T00:00:00Z"));
    }

    private static MockMultipartFile file() {
        return new MockMultipartFile("file", "01.jpg", "image/jpeg", JPEG_BYTES);
    }

    @Test
    @DisplayName("上傳成功：201、Location 指向新照片、body 是照片資料，不含 storageKey")
    void shouldCreatePhoto() throws Exception {
        when(photoService.upload(eq(7L), any(), eq(12))).thenReturn(sample(55, 12));

        mockMvc.perform(multipart(UPLOAD_URL, 7).file(file()).param("frameNumber", "12"))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, "/api/v1/photos/55"))
                .andExpect(jsonPath("$.id").value(55))
                .andExpect(jsonPath("$.filmRollId").value(7))
                .andExpect(jsonPath("$.frameNumber").value(12))
                .andExpect(jsonPath("$.originalFilename").value("01.jpg"))
                .andExpect(jsonPath("$.width").value(1200))
                .andExpect(jsonPath("$.height").value(800))
                .andExpect(jsonPath("$.sizeBytes").value(4321))
                .andExpect(jsonPath("$.createdAt").value("2026-03-01T00:00:00Z"))
                .andExpect(jsonPath("$.storageKey").doesNotExist());

        ArgumentCaptor<MultipartFile> uploaded = ArgumentCaptor.forClass(MultipartFile.class);
        verify(photoService).upload(eq(7L), uploaded.capture(), eq(12));
        assertThat(uploaded.getValue().getBytes()).isEqualTo(JPEG_BYTES);
        assertThat(uploaded.getValue().getOriginalFilename()).isEqualTo("01.jpg");
    }

    @Test
    @DisplayName("沒帶 frameNumber：Service 收到 null（由它決定格號），不是 0")
    void shouldPassNullWhenFrameNumberMissing() throws Exception {
        when(photoService.upload(eq(7L), any(), isNull())).thenReturn(sample(1, 1));

        mockMvc.perform(multipart(UPLOAD_URL, 7).file(file()))
                .andExpect(status().isCreated());

        verify(photoService).upload(eq(7L), any(), isNull());
    }

    @Test
    @DisplayName("列出：原樣回傳 Service 給的順序")
    void shouldListPhotos() throws Exception {
        when(photoService.listByRoll(7L)).thenReturn(List.of(sample(2, 0), sample(1, 5)));

        mockMvc.perform(get("/api/v1/film-rolls/{id}/photos", 7))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(2))
                .andExpect(jsonPath("$[0].frameNumber").value(0))
                .andExpect(jsonPath("$[1].id").value(1))
                .andExpect(jsonPath("$[1].frameNumber").value(5));
    }

    @Test
    @DisplayName("卷期沒有照片：200 與空陣列，不是 404")
    void shouldListEmptyArray() throws Exception {
        when(photoService.listByRoll(7L)).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/film-rolls/{id}/photos", 7))
                .andExpect(status().isOk())
                .andExpect(content().string("[]"));
    }

    @Test
    @DisplayName("刪除成功：204 沒有 body，並以路徑上的 id 呼叫 Service")
    void shouldDeletePhoto() throws Exception {
        mockMvc.perform(delete("/api/v1/photos/{id}", 55))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));

        verify(photoService).delete(55L);
    }

    // ---------------------------------------------------------------------
    // 例外 → 狀態碼與 ProblemDetail
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("InvalidPhotoException → 400，訊息原樣轉述")
    void shouldMapInvalidPhotoTo400() throws Exception {
        when(photoService.upload(anyLong(), any(), any())).thenThrow(new InvalidPhotoException("只接受 JPEG 檔"));

        mockMvc.perform(multipart(UPLOAD_URL, 7).file(file()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.title").value("商業規則驗證失敗"))
                .andExpect(jsonPath("$.type").value("urn:kokoroe:problem:business-rule-violated"))
                .andExpect(jsonPath("$.detail").value("只接受 JPEG 檔"));
    }

    @Test
    @DisplayName("DuplicateFrameException → 409，訊息說明是第幾格")
    void shouldMapDuplicateFrameTo409() throws Exception {
        when(photoService.upload(anyLong(), any(), any())).thenThrow(new DuplicateFrameException(5));

        mockMvc.perform(multipart(UPLOAD_URL, 7).file(file()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.title").value("資源衝突"))
                .andExpect(jsonPath("$.detail").value(containsString("第 5 格")));
    }

    @Test
    @DisplayName("卷期或照片不存在 → 404")
    void shouldMapNotFoundTo404() throws Exception {
        when(photoService.upload(eq(99L), any(), any())).thenThrow(new FilmRollNotFoundException(99L));
        when(photoService.getById(98L)).thenThrow(new PhotoNotFoundException(98L));

        mockMvc.perform(multipart(UPLOAD_URL, 99).file(file()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.type").value("urn:kokoroe:problem:resource-not-found"))
                .andExpect(jsonPath("$.detail").value(containsString("99")));
        mockMvc.perform(get("/api/v1/photos/{id}", 98))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value(containsString("98")));
    }

    @Test
    @DisplayName("UploadBusyException → 503（請求沒問題，稍後重試）")
    void shouldMapBusyTo503() throws Exception {
        when(photoService.upload(anyLong(), any(), any())).thenThrow(new UploadBusyException());

        mockMvc.perform(multipart(UPLOAD_URL, 7).file(file()))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value(503))
                .andExpect(jsonPath("$.title").value("伺服器忙碌"))
                .andExpect(jsonPath("$.type").value("urn:kokoroe:problem:service-busy"));
    }

    @Test
    @DisplayName("資料庫約束擋下（同時搶同一格）→ 409，約束名稱與 SQL 不外洩")
    void shouldMapDataIntegrityViolationTo409WithoutLeaking() throws Exception {
        when(photoService.upload(anyLong(), any(), any())).thenThrow(
                new DataIntegrityViolationException("ERROR: duplicate key value violates unique constraint \"uq_photo_roll_frame\""));

        mockMvc.perform(multipart(UPLOAD_URL, 7).file(file()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.detail").value(not(containsString("uq_photo_roll_frame"))))
                .andExpect(jsonPath("$.detail").value(not(containsString("duplicate key"))));
    }

    @Test
    @DisplayName("超過檔案大小上限 → 413")
    void shouldMapUploadTooLargeTo413() throws Exception {
        when(photoService.upload(anyLong(), any(), any())).thenThrow(new MaxUploadSizeExceededException(41_943_040L));

        mockMvc.perform(multipart(UPLOAD_URL, 7).file(file()))
                .andExpect(status().is(413))
                .andExpect(jsonPath("$.status").value(413))
                .andExpect(jsonPath("$.title").value("檔案太大"));
    }

    @Test
    @DisplayName("multipart 解析失敗 → 400，例外訊息裡的伺服器路徑不外洩")
    void shouldMapMultipartFailureTo400WithoutLeaking() throws Exception {
        when(photoService.upload(anyLong(), any(), any())).thenThrow(
                new MultipartException("Failed to write to C:\\secret\\tomcat\\work\\upload_123.tmp"));

        mockMvc.perform(multipart(UPLOAD_URL, 7).file(file()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").value("上傳的內容無法解析"));
    }

    @Test
    @DisplayName("未預期的例外 → 500，只有通用訊息（例外內容不外洩）")
    void shouldMapUnexpectedTo500WithoutLeaking() throws Exception {
        when(photoService.upload(anyLong(), any(), any())).thenThrow(new IllegalStateException("s3 password=hunter2"));

        mockMvc.perform(multipart(UPLOAD_URL, 7).file(file()))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.type").value("urn:kokoroe:problem:internal-error"))
                .andExpect(jsonPath("$.detail").value(not(containsString("hunter2"))));
    }

    @Test
    @DisplayName("Spring 標準的 4xx 保留原狀態碼與標頭：405 附 Allow、415 附 Accept，body 仍是 ProblemDetail")
    void shouldKeepStandardClientErrors() throws Exception {
        mockMvc.perform(post("/api/v1/photos/{id}", 1))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(header().string(HttpHeaders.ALLOW, containsString("GET")))
                .andExpect(header().string(HttpHeaders.ALLOW, containsString("DELETE")))
                .andExpect(header().string(HttpHeaders.ALLOW, not(containsString("POST"))))
                .andExpect(jsonPath("$.status").value(405))
                .andExpect(jsonPath("$.type").value("urn:kokoroe:problem:malformed-request"));

        mockMvc.perform(post(UPLOAD_URL, 7).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.status").value(415));

        mockMvc.perform(multipart(UPLOAD_URL, 7).file(new MockMultipartFile("photo", "01.jpg", "image/jpeg", JPEG_BYTES)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").value(containsString("file")));

        verifyNoInteractions(photoService);
    }

    @ParameterizedTest
    @ValueSource(strings = {"abc", "1.5", "99999999999", "1e1"})
    @DisplayName("frameNumber 不是整數 → 400，Service 不會被呼叫")
    void shouldRejectNonIntegerFrameNumber(String value) throws Exception {
        mockMvc.perform(multipart(UPLOAD_URL, 7).file(file()).param("frameNumber", value))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").value(containsString("frameNumber")));

        verify(photoService, never()).upload(anyLong(), any(), any());
    }

    // ---------------------------------------------------------------------
    // 圖檔
    // ---------------------------------------------------------------------

    @ParameterizedTest
    @ValueSource(strings = {"thumb", "web", "original"})
    @DisplayName("圖檔：JPEG、Content-Length、長期私有快取、nosniff 與 sandbox CSP，內容原樣轉出")
    void shouldServeContentWithSafeHeaders(String variant) throws Exception {
        when(photoService.openContent(eq(55L), any()))
                .thenReturn(new StoredObject(new ByteArrayInputStream(JPEG_BYTES), JPEG_BYTES.length));

        byte[] body = mockMvc.perform(get("/api/v1/photos/{id}/{variant}", 55, variant))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, MediaType.IMAGE_JPEG_VALUE))
                .andExpect(header().longValue(HttpHeaders.CONTENT_LENGTH, JPEG_BYTES.length))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "max-age=31536000, private, immutable"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Content-Security-Policy", "default-src 'none'; sandbox"))
                .andReturn().getResponse().getContentAsByteArray();

        assertThat(body).isEqualTo(JPEG_BYTES);
        PhotoVariant expected = PhotoVariant.fromPathSegment(variant);
        verify(photoService).openContent(55L, expected);
    }

    @Test
    @DisplayName("圖檔串流送完之後要關閉，否則每張圖都漏一條到儲存空間的連線")
    void shouldCloseStreamAfterWriting() throws Exception {
        AtomicBoolean closed = new AtomicBoolean();
        ByteArrayInputStream stream = new ByteArrayInputStream(JPEG_BYTES) {
            @Override
            public void close() throws IOException {
                closed.set(true);
                super.close();
            }
        };
        when(photoService.openContent(eq(55L), any())).thenReturn(new StoredObject(stream, JPEG_BYTES.length));

        mockMvc.perform(get("/api/v1/photos/{id}/thumb", 55)).andExpect(status().isOk());

        assertThat(closed).isTrue();
    }

    @Test
    @DisplayName("版本名稱不認得 → 400，不會去查資料庫或儲存空間")
    void shouldRejectUnknownVariant() throws Exception {
        mockMvc.perform(get("/api/v1/photos/{id}/{variant}", 55, "large"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").value(containsString("variant")));

        verifyNoInteractions(photoService);
    }

    @Test
    @DisplayName("圖檔對應不到（紀錄或檔案不見）→ 404，沒有任何圖片標頭")
    void shouldReturn404WhenContentMissing() throws Exception {
        when(photoService.openContent(eq(55L), any())).thenThrow(new PhotoNotFoundException(55L));

        mockMvc.perform(get("/api/v1/photos/{id}/thumb", 55))
                .andExpect(status().isNotFound())
                .andExpect(header().doesNotExist(HttpHeaders.CACHE_CONTROL))
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    @DisplayName("瀏覽器中途斷線不是錯誤：不能被兜底 handler 變成 500 與錯誤 body")
    void shouldTreatClientDisconnectAsNotAnError() throws Exception {
        // IOException 是檢查型例外，thenThrow 不收；真實情況是寫回應時才丟出來
        when(photoService.openContent(eq(55L), any())).thenAnswer(invocation -> {
            throw new AsyncRequestNotUsableException("ServletOutputStream failed to write: Broken pipe");
        });

        mockMvc.perform(get("/api/v1/photos/{id}/thumb", 55))
                .andExpect(status().is(not(500)))
                .andExpect(content().string(""));
    }
}
