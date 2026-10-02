package com.kokoroe.photo;

import com.kokoroe.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * V4 migration 的資料庫約束：直接用 SQL 寫入，不經過應用層的檢查，確認「最後一道防線」真的在。
 * 應用層的驗證（Service 先擋）可能被競態或日後的 bug 繞過，這些約束才是最終保證。
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@DisplayName("photo 資料表的約束（V4）")
class PhotoSchemaIntegrationTest {

    private static final String INSERT = """
            INSERT INTO photo (film_roll_id, frame_number, storage_key, original_filename, width, height, size_bytes, created_at)
            VALUES (?, ?, ?, 'x.jpg', ?, ?, ?, now())
            """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbc;

    private long rollId;
    private int keyCounter;

    @BeforeEach
    void createRoll() throws Exception {
        rollId = newRoll();
    }

    private long newRoll() throws Exception {
        String created = mockMvc.perform(post("/api/v1/film-rolls")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "filmName": "Fuji Superia 400",
                                  "brand": "Fujifilm",
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

    private String uniqueKey() {
        return "schema-test/%d/%d-%d".formatted(rollId, System.nanoTime(), keyCounter++);
    }

    private void insert(long roll, int frame, String key, int width, int height, long size) {
        jdbc.update(INSERT, roll, frame, key, width, height, size);
    }

    private long countPhotos(long roll) {
        return jdbc.queryForObject("SELECT count(*) FROM photo WHERE film_roll_id = ?", Long.class, roll);
    }

    @Test
    @DisplayName("格號 0 與 99 是合法的最小與最大值")
    void shouldAcceptBoundaryFrames() {
        insert(rollId, 0, uniqueKey(), 10, 10, 10);
        insert(rollId, 99, uniqueKey(), 10, 10, 10);

        assertThat(countPhotos(rollId)).isEqualTo(2);
    }

    @Test
    @DisplayName("格號 -1 與 100 被 CHECK 擋下")
    void shouldRejectFramesOutsideRange() {
        assertThatThrownBy(() -> insert(rollId, -1, uniqueKey(), 10, 10, 10))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("ck_photo_frame_number");
        assertThatThrownBy(() -> insert(rollId, 100, uniqueKey(), 10, 10, 10))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("ck_photo_frame_number");
        assertThat(countPhotos(rollId)).isZero();
    }

    @Test
    @DisplayName("寬、高、檔案大小必須大於 0")
    void shouldRejectNonPositiveDimensionsAndSize() {
        assertThatThrownBy(() -> insert(rollId, 1, uniqueKey(), 0, 10, 10))
                .isInstanceOf(DataIntegrityViolationException.class).hasMessageContaining("ck_photo_dimensions");
        assertThatThrownBy(() -> insert(rollId, 1, uniqueKey(), 10, -5, 10))
                .isInstanceOf(DataIntegrityViolationException.class).hasMessageContaining("ck_photo_dimensions");
        assertThatThrownBy(() -> insert(rollId, 1, uniqueKey(), 10, 10, 0))
                .isInstanceOf(DataIntegrityViolationException.class).hasMessageContaining("ck_photo_size_bytes");
        assertThat(countPhotos(rollId)).isZero();
    }

    @Test
    @DisplayName("同一卷同一格只能有一張；不同卷可以有同樣的格號")
    void shouldEnforceUniqueFramePerRoll() throws Exception {
        long otherRoll = newRoll();
        insert(rollId, 5, uniqueKey(), 10, 10, 10);

        assertThatThrownBy(() -> insert(rollId, 5, uniqueKey(), 10, 10, 10))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("uq_photo_roll_frame");
        insert(otherRoll, 5, uniqueKey(), 10, 10, 10);

        assertThat(countPhotos(rollId)).isEqualTo(1);
        assertThat(countPhotos(otherRoll)).isEqualTo(1);
    }

    @Test
    @DisplayName("storage key 全域唯一：兩張照片不能指向同一組檔案")
    void shouldEnforceUniqueStorageKey() throws Exception {
        long otherRoll = newRoll();
        String key = uniqueKey();
        insert(rollId, 1, key, 10, 10, 10);

        assertThatThrownBy(() -> insert(otherRoll, 1, key, 10, 10, 10))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("uq_photo_storage_key");
    }

    @Test
    @DisplayName("不存在的卷期：外鍵擋下")
    void shouldRejectUnknownRoll() {
        assertThatThrownBy(() -> insert(Long.MAX_VALUE, 1, uniqueKey(), 10, 10, 10))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("film_roll_id");
    }

    @Test
    @DisplayName("必填欄位不能是 NULL")
    void shouldRejectNulls() {
        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO photo (film_roll_id, frame_number, storage_key, width, height, size_bytes, created_at) "
                        + "VALUES (?, 1, NULL, 10, 10, 10, now())", rollId))
                .isInstanceOf(DataIntegrityViolationException.class);
        // original_filename 是選填
        jdbc.update("INSERT INTO photo (film_roll_id, frame_number, storage_key, width, height, size_bytes, created_at) "
                + "VALUES (?, 1, ?, 10, 10, 10, now())", rollId, uniqueKey());
        assertThat(countPhotos(rollId)).isEqualTo(1);
    }

    @Test
    @DisplayName("資料庫層的 ON DELETE CASCADE：直接刪掉卷期，照片紀錄跟著刪，別卷的不受影響")
    void shouldCascadeDeleteToPhotos() throws Exception {
        long otherRoll = newRoll();
        insert(rollId, 1, uniqueKey(), 10, 10, 10);
        insert(rollId, 2, uniqueKey(), 10, 10, 10);
        insert(otherRoll, 1, uniqueKey(), 10, 10, 10);

        jdbc.update("DELETE FROM film_roll WHERE id = ?", rollId);

        assertThat(countPhotos(rollId)).isZero();
        assertThat(countPhotos(otherRoll)).isEqualTo(1);
    }

    @Test
    @DisplayName("storage_key 欄位長度 100：應用層產生的 key 放得下（最長的 roll id 也一樣）")
    void shouldFitGeneratedStorageKeyInColumn() {
        // rolls/{Long.MAX_VALUE 的 19 位數}/{UUID 36 字元}
        String longest = "rolls/%d/%s".formatted(Long.MAX_VALUE, java.util.UUID.randomUUID());

        assertThat(longest.length()).isLessThanOrEqualTo(100);
        insert(rollId, 1, longest, 10, 10, 10);
        assertThatThrownBy(() -> insert(rollId, 2, "x".repeat(101), 10, 10, 10))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
