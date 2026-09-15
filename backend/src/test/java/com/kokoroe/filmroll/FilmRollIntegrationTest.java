package com.kokoroe.filmroll;

import com.kokoroe.TestcontainersConfiguration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
// Spring Boot 4 已改用 Jackson 3（tools.jackson），不再是 com.fasterxml.jackson。
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 端到端整合測試：真的起一個 PostgreSQL 16 容器，跑完整的 Spring context。
 *
 * <p>這一層要驗證單元測試看不到的東西：Flyway migration 跑不跑得起來、
 * Hibernate 的 {@code ddl-auto: validate} 有沒有跟 SQL schema 對上、
 * enum 的字串映射是否正確落地、JPA Auditing 有沒有真的填值。
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@DisplayName("FilmRoll 端到端整合測試")
class FilmRollIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private FilmRollRepository filmRollRepository;

    private static final String CREATE_BODY = """
            {
              "filmName": "Kodak Portra 400",
              "brand": "Kodak",
              "iso": 400,
              "format": "135",
              "pushPullStops": 1,
              "loadedAt": "2026-03-01",
              "cameraName": "Nikon FM2",
              "lensName": "50mm f/1.4",
              "notes": "櫻花季，推一格"
            }
            """;

    @Test
    @DisplayName("完整生命週期：新增 → 查詢 → 列表 → 更新 → 拒絕逆向流轉 → 刪除 → 查無")
    void shouldSupportFullLifecycle() throws Exception {
        // --- 新增 -------------------------------------------------------
        String created = mockMvc.perform(post("/api/v1/film-rolls")
                        .contentType(MediaType.APPLICATION_JSON).content(CREATE_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.format").value("135"))
                .andExpect(jsonPath("$.status").value("LOADED"))
                .andExpect(jsonPath("$.createdAt").exists())
                .andReturn().getResponse().getContentAsString();

        long id = objectMapper.readTree(created).get("id").asLong();

        // --- 單筆查詢 ---------------------------------------------------
        mockMvc.perform(get("/api/v1/film-rolls/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.filmName").value("Kodak Portra 400"))
                .andExpect(jsonPath("$.pushPullStops").value(1))
                .andExpect(jsonPath("$.notes").value("櫻花季，推一格"));

        // --- 列表（依狀態篩選）------------------------------------------
        mockMvc.perform(get("/api/v1/film-rolls").param("status", "LOADED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.id == %d)]".formatted(id)).exists())
                .andExpect(jsonPath("$.size").value(20));

        // 篩選其他狀態時不該出現這筆
        mockMvc.perform(get("/api/v1/film-rolls").param("status", "ARCHIVED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.id == %d)]".formatted(id)).doesNotExist());

        // --- 更新（向前推進狀態）----------------------------------------
        String updateBody = """
                {
                  "filmName": "Kodak Portra 400",
                  "brand": "Kodak",
                  "iso": 400,
                  "format": "135",
                  "pushPullStops": 1,
                  "loadedAt": "2026-03-01",
                  "finishedAt": "2026-03-20",
                  "cameraName": "Nikon FM2",
                  "lensName": "50mm f/1.4",
                  "notes": "拍完了，送洗",
                  "status": "DEVELOPING"
                }
                """;

        mockMvc.perform(put("/api/v1/film-rolls/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON).content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DEVELOPING"))
                .andExpect(jsonPath("$.finishedAt").value("2026-03-20"));

        // --- 逆向流轉應被擋下（409）--------------------------------------
        mockMvc.perform(put("/api/v1/film-rolls/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody.replace("\"DEVELOPING\"", "\"LOADED\"")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("狀態衝突"));

        // --- 刪除，並確認真的不見了 --------------------------------------
        mockMvc.perform(delete("/api/v1/film-rolls/{id}", id))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/film-rolls/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    @DisplayName("JPA Auditing 應自動填入時間戳，且更新後 updatedAt 要往前走")
    void shouldPopulateAuditTimestamps() throws Exception {
        String created = mockMvc.perform(post("/api/v1/film-rolls")
                        .contentType(MediaType.APPLICATION_JSON).content(CREATE_BODY))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        JsonNode createdNode = objectMapper.readTree(created);
        long id = createdNode.get("id").asLong();

        FilmRoll persisted = filmRollRepository.findById(id).orElseThrow();
        assertThat(persisted.getCreatedAt()).isNotNull();
        assertThat(persisted.getUpdatedAt()).isNotNull();
        // 時間戳必須截斷到微秒，才能與 PostgreSQL 的儲存精度一致；
        // 否則「剛寫入的值」與「讀回來的值」會不相等。詳見 JpaAuditingConfig。
        assertThat(persisted.getCreatedAt().getNano() % 1_000)
                .as("createdAt 應已截斷至微秒精度")
                .isZero();
        // enum 必須以字串形式落地（EnumType.STRING）
        assertThat(persisted.getFormat()).isEqualTo(FilmFormat.FORMAT_135);
        assertThat(persisted.getStatus()).isEqualTo(FilmRollStatus.LOADED);

        String updateBody = """
                {
                  "filmName": "Kodak Portra 400",
                  "iso": 400,
                  "format": "135",
                  "loadedAt": "2026-03-01",
                  "status": "SHOOTING"
                }
                """;

        String updated = mockMvc.perform(put("/api/v1/film-rolls/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON).content(updateBody))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode updatedNode = objectMapper.readTree(updated);
        assertThat(updatedNode.get("createdAt").asString())
                .isEqualTo(createdNode.get("createdAt").asString());
        assertThat(updatedNode.get("updatedAt").asString())
                .isNotEqualTo(createdNode.get("updatedAt").asString());

        filmRollRepository.deleteById(id);
    }

    @Test
    @DisplayName("拍完日期早於裝片日期應回 400，且不留下任何資料")
    void shouldRejectInvalidDateRange() throws Exception {
        long before = filmRollRepository.count();

        String body = """
                {
                  "filmName": "Ilford HP5",
                  "iso": 400,
                  "format": "120",
                  "loadedAt": "2026-03-01",
                  "finishedAt": "2026-02-01"
                }
                """;

        mockMvc.perform(post("/api/v1/film-rolls")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("商業規則驗證失敗"));

        assertThat(filmRollRepository.count()).isEqualTo(before);
    }
}
