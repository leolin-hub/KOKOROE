package com.kokoroe.filmroll;

import com.kokoroe.camera.dto.CameraSummaryResponse;
import com.kokoroe.common.GlobalExceptionHandler;
import com.kokoroe.common.dto.PageResponse;
import com.kokoroe.filmroll.dto.FilmRollResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
// Spring Boot 4 已改用 Jackson 3：ObjectMapper 從 com.fasterxml.jackson.databind
// 移到 tools.jackson.databind。（註解類別仍留在 com.fasterxml.jackson.annotation）
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Web 層切片測試：只載入 MVC 相關的基礎設施，Service 用 mock 取代。
 *
 * <p>驗證的是「HTTP 契約」——狀態碼、header、JSON 形狀、驗證有沒有真的被觸發，
 * 而不是商業邏輯（那已在 {@link FilmRollServiceTest} 覆蓋）。
 */
@WebMvcTest(FilmRollController.class)
@Import(GlobalExceptionHandler.class)
@DisplayName("FilmRollController HTTP 契約")
class FilmRollControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private FilmRollService filmRollService;

    private static FilmRollResponse sampleResponse(Long id) {
        return new FilmRollResponse(id, "Kodak Portra 400", "Kodak", 400,
                FilmFormat.FORMAT_135, 0, LocalDate.of(2026, 3, 1), null,
                new CameraSummaryResponse(7L, "Nikon FM2"), "50mm f/1.4", null, FilmRollStatus.LOADED,
                Instant.parse("2026-03-01T00:00:00Z"), Instant.parse("2026-03-01T00:00:00Z"));
    }

    @Test
    @DisplayName("POST 合法內容應回 201，並在 Location header 指出新資源位置")
    void shouldReturn201WithLocation() throws Exception {
        when(filmRollService.create(any())).thenReturn(sampleResponse(1L));

        Map<String, Object> body = Map.of(
                "filmName", "Kodak Portra 400",
                "brand", "Kodak",
                "iso", 400,
                "format", "135",
                "loadedAt", "2026-03-01");

        mockMvc.perform(post("/api/v1/film-rolls")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/v1/film-rolls/1"))
                .andExpect(jsonPath("$.id").value(1))
                // 對外契約是 "135"，不是內部常數名 FORMAT_135
                .andExpect(jsonPath("$.format").value("135"))
                .andExpect(jsonPath("$.camera.id").value(7))
                .andExpect(jsonPath("$.camera.name").value("Nikon FM2"))
                .andExpect(jsonPath("$.status").value("LOADED"));
    }

    @Test
    @DisplayName("POST 欄位驗證失敗應回 400，且逐欄列出錯誤")
    void shouldReturn400WithFieldErrors() throws Exception {
        String body = """
                {"filmName": "", "iso": -100, "format": "135",
                 "pushPullStops": 99, "loadedAt": "2026-03-01"}
                """;

        mockMvc.perform(post("/api/v1/film-rolls")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("輸入驗證失敗"))
                .andExpect(jsonPath("$.errors").isArray())
                .andExpect(jsonPath("$.errors[?(@.field == 'filmName')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field == 'iso')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field == 'pushPullStops')]").exists());
    }

    @Test
    @DisplayName("POST 不支援的底片規格應回 400，並說明可用值")
    void shouldReturn400ForUnknownFormat() throws Exception {
        String body = """
                {"filmName": "Some Film", "iso": 400, "format": "220", "loadedAt": "2026-03-01"}
                """;

        mockMvc.perform(post("/api/v1/film-rolls")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("220")));
    }

    @Test
    @DisplayName("GET 查無資料應回 404 problem+json，不得洩漏 stack trace")
    void shouldReturn404() throws Exception {
        when(filmRollService.getById(999L)).thenThrow(new FilmRollNotFoundException(999L));

        mockMvc.perform(get("/api/v1/film-rolls/999"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.title").value("找不到資源"))
                .andExpect(jsonPath("$.stackTrace").doesNotExist())
                .andExpect(jsonPath("$.trace").doesNotExist());
    }

    @Test
    @DisplayName("GET 路徑參數型別錯誤應回 400 而非 500")
    void shouldReturn400ForBadPathVariable() throws Exception {
        mockMvc.perform(get("/api/v1/film-rolls/not-a-number"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("參數型別錯誤"));
    }

    @Test
    @DisplayName("逆向狀態流轉應回 409 Conflict，而不是 400")
    void shouldReturn409ForIllegalTransition() throws Exception {
        when(filmRollService.update(eq(1L), any()))
                .thenThrow(new IllegalStatusTransitionException(
                        FilmRollStatus.ARCHIVED, FilmRollStatus.SHOOTING));

        String body = """
                {"filmName": "Kodak Portra 400", "iso": 400, "format": "135",
                 "loadedAt": "2026-03-01", "status": "SHOOTING"}
                """;

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/v1/film-rolls/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("狀態衝突"));
    }

    @Test
    @DisplayName("GET 列表應回傳自訂的分頁結構")
    void shouldReturnPagedList() throws Exception {
        when(filmRollService.list(any(), any()))
                .thenReturn(new PageResponse<>(List.of(sampleResponse(1L)), 0, 20, 1, 1, true, true));

        mockMvc.perform(get("/api/v1/film-rolls").param("status", "LOADED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content[0].id").value(1))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.page").value(0));
    }

    @Test
    @DisplayName("DELETE 成功應回 204 且沒有 body")
    void shouldReturn204OnDelete() throws Exception {
        mockMvc.perform(delete("/api/v1/film-rolls/1"))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));
    }

    @Test
    @DisplayName("DELETE 不存在的資料應回 404")
    void shouldReturn404OnDeletingMissing() throws Exception {
        doThrow(new FilmRollNotFoundException(999L)).when(filmRollService).delete(999L);

        mockMvc.perform(delete("/api/v1/film-rolls/999"))
                .andExpect(status().isNotFound());
    }
}
