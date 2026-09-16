package com.kokoroe.camera;

import com.kokoroe.TestcontainersConfiguration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Camera 端到端整合測試。
 *
 * <p>類別上的註解與 {@code FilmRollIntegrationTest} 完全相同，Spring 才會重用同一個 context
 * 與同一個 PostgreSQL 容器，而不是再啟動一個。
 *
 * <p>相機型號一律加上隨機字尾：所有整合測試共用同一個資料庫，固定名稱會撞到唯一索引。
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@DisplayName("Camera 端到端整合測試")
class CameraIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private long postCamera(String body) throws Exception {
        String created = mockMvc.perform(post("/api/v1/cameras")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(created).get("id").asLong();
    }

    private static String uniqueModel(String prefix) {
        return prefix + "-" + UUID.randomUUID();
    }

    @Test
    @DisplayName("完整生命週期：新增 → 查詢 → 列表 → 更新 → 使用中不可刪 → 刪除 → 查無")
    void shouldSupportFullLifecycle() throws Exception {
        String model = uniqueModel("PG-50");

        // --- 新增（含全部規格欄位）---------------------------------------
        String created = mockMvc.perform(post("/api/v1/cameras")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "brand": "PENTAX",
                                  "model": "%s",
                                  "format": "135",
                                  "cameraType": "POINT_AND_SHOOT",
                                  "focusType": "AUTO",
                                  "filmAdvance": "AUTO",
                                  "hasFlash": true,
                                  "interchangeableLens": false,
                                  "fixedLens": "35mm f/4.5",
                                  "isoMin": 100,
                                  "isoMax": 400
                                }
                                """.formatted(model)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("PENTAX " + model))
                .andExpect(jsonPath("$.format").value("135"))
                .andExpect(jsonPath("$.hasFlash").value(true))
                .andExpect(jsonPath("$.interchangeableLens").value(false))
                .andExpect(jsonPath("$.createdAt").exists())
                .andReturn().getResponse().getContentAsString();
        long id = objectMapper.readTree(created).get("id").asLong();

        // --- 查詢與列表 ---------------------------------------------------
        mockMvc.perform(get("/api/v1/cameras/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fixedLens").value("35mm f/4.5"))
                .andExpect(jsonPath("$.isoMax").value(400));

        mockMvc.perform(get("/api/v1/cameras"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(100))
                .andExpect(jsonPath("$.content[?(@.id == %d)]".formatted(id)).exists());

        // --- 更新：改成半格機，沒送的規格應被清掉（PUT 整份取代）-------------
        mockMvc.perform(put("/api/v1/cameras/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"brand": "PENTAX", "model": "%s", "format": "half-frame"}
                                """.formatted(model)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.format").value("half-frame"))
                .andExpect(jsonPath("$.fixedLens").doesNotExist())
                .andExpect(jsonPath("$.hasFlash").doesNotExist());

        // --- 有卷期使用時不可刪除 -------------------------------------------
        String roll = mockMvc.perform(post("/api/v1/film-rolls")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"filmName": "Kodak Gold 200", "iso": 200, "format": "135",
                                 "loadedAt": "2026-03-01", "cameraId": %d}
                                """.formatted(id)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long rollId = objectMapper.readTree(roll).get("id").asLong();

        mockMvc.perform(delete("/api/v1/cameras/{id}", id))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("資源衝突"));

        // --- 卷期刪掉後就能刪相機 -------------------------------------------
        mockMvc.perform(delete("/api/v1/film-rolls/{id}", rollId))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/v1/cameras/{id}", id))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/cameras/{id}", id))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("同名相機（不分大小寫、忽略多餘空白）應回 409")
    void shouldRejectDuplicateName() throws Exception {
        String model = uniqueModel("FM2");
        postCamera("""
                {"brand": "Nikon", "model": "%s", "format": "135"}
                """.formatted(model));

        mockMvc.perform(post("/api/v1/cameras")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"brand": "  nikon ", "model": "%s", "format": "135"}
                                """.formatted(model.toLowerCase())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("資源衝突"));
    }

    @Test
    @DisplayName("把相機改名成另一台相機的名稱應回 409，而不是 500")
    void shouldRejectRenameToExistingName() throws Exception {
        String takenModel = uniqueModel("FM2");
        postCamera("""
                {"brand": "Nikon", "model": "%s", "format": "135"}
                """.formatted(takenModel));
        long otherId = postCamera("""
                {"brand": "Nikon", "model": "%s", "format": "135"}
                """.formatted(uniqueModel("FE2")));

        mockMvc.perform(put("/api/v1/cameras/{id}", otherId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"brand": "Nikon", "model": "%s", "format": "135"}
                                """.formatted(takenModel)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("已經有名為「Nikon %s」的相機".formatted(takenModel)));
    }

    @Test
    @DisplayName("欄位驗證與跨欄位規則：缺型號、可換鏡頭卻填定焦鏡頭、不支援的片幅")
    void shouldValidateInput() throws Exception {
        mockMvc.perform(post("/api/v1/cameras")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"brand": "Nikon", "format": "135", "isoMin": 0}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.field == 'model')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field == 'isoMin')]").exists());

        mockMvc.perform(post("/api/v1/cameras")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"brand": "Nikon", "model": "%s", "format": "135",
                                 "interchangeableLens": true, "fixedLens": "50mm f/1.4"}
                                """.formatted(uniqueModel("FM2"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("商業規則驗證失敗"));

        mockMvc.perform(post("/api/v1/cameras")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"model": "Some Camera", "format": "220"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("half-frame")));
    }

    @Test
    @DisplayName("卷期引用不存在的相機、或底片規格與相機不合時應回 400")
    void shouldRejectInvalidCameraOnFilmRoll() throws Exception {
        mockMvc.perform(post("/api/v1/film-rolls")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"filmName": "Kodak Gold 200", "iso": 200, "format": "135",
                                 "loadedAt": "2026-03-01", "cameraId": 999999}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("找不到 id 為 999999 的相機"));

        long mediumFormat = postCamera("""
                {"brand": "Mamiya", "model": "%s", "format": "120"}
                """.formatted(uniqueModel("RB67")));

        mockMvc.perform(post("/api/v1/film-rolls")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"filmName": "Kodak Gold 200", "iso": 200, "format": "135",
                                 "loadedAt": "2026-03-01", "cameraId": %d}
                                """.formatted(mediumFormat)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("商業規則驗證失敗"));
    }
}
