package com.kokoroe.camera;

import com.kokoroe.TestcontainersConfiguration;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

/**
 * V2 migration 的資料搬遷測試。
 *
 * <p>應用程式啟動時 Flyway 已經把 V1、V2 一口氣跑完，那時資料表是空的，驗證不到搬遷邏輯。
 * 所以這裡在同一個容器裡另開一個 schema，手動控制 Flyway：
 * 先只跑到 V1 → 塞入舊格式的資料 → 再跑 V2 → 檢查結果。
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@DisplayName("V2 migration：camera_name 搬遷到 camera 表")
class CameraMigrationTest {

    private static final String SCHEMA = "migration_v2_test";

    @Autowired
    private DataSource dataSource;

    private JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
    }

    private Flyway flywayUpTo(String version) {
        return Flyway.configure()
                .dataSource(dataSource)
                .schemas(SCHEMA)
                .locations("classpath:db/migration")
                .target(version)
                .load();
    }

    private void insertRoll(String cameraName, String format) {
        jdbc.update("""
                INSERT INTO %s.film_roll (film_name, iso, format, loaded_at, camera_name, status, created_at, updated_at)
                VALUES ('Kodak Gold 200', 200, ?, DATE '2026-03-01', ?, 'LOADED', now(), now())
                """.formatted(SCHEMA), format, cameraName);
    }

    @Test
    @DisplayName("應去重建立相機、拆出品牌與型號，並回填 camera_id")
    void shouldBackfillCameras() {
        flywayUpTo("1").migrate();

        insertRoll("PENTAX PG-50", "FORMAT_135");
        insertRoll("PENTAX PG-50", "FORMAT_135");
        insertRoll("  pentax   PG-50 ", "FORMAT_135"); // 大小寫與空白不同，仍是同一台
        insertRoll("Mamiya RB67", "FORMAT_120");
        insertRoll("Holga", "FORMAT_120");              // 沒有空白：整串當型號
        insertRoll(null, "FORMAT_135");
        insertRoll("   ", "FORMAT_135");                // 空白字串視同沒填
        insertRoll("Nikon FM2", "FORMAT_135");
        insertRoll("Nikon FM2", "FORMAT_135");
        insertRoll("nikon fm2", "FORMAT_120");          // 同名但規格不同：相機取多數的 135，這卷不連

        flywayUpTo("2").migrate();

        List<Map<String, Object>> cameras = jdbc.queryForList(
                "SELECT brand, model, format FROM %s.camera ORDER BY model".formatted(SCHEMA));
        assertThat(cameras)
                .extracting(c -> c.get("brand"), c -> c.get("model"), c -> c.get("format"))
                .containsExactly(
                        tuple("Nikon", "FM2", "FORMAT_135"),
                        tuple(null, "Holga", "FORMAT_120"),
                        tuple("PENTAX", "PG-50", "FORMAT_135"),
                        tuple("Mamiya", "RB67", "FORMAT_120"));

        List<Map<String, Object>> rolls = jdbc.queryForList("""
                SELECT r.camera_name, concat_ws(' ', c.brand, c.model) AS linked
                FROM %s.film_roll r LEFT JOIN %s.camera c ON c.id = r.camera_id
                ORDER BY r.id
                """.formatted(SCHEMA, SCHEMA));
        assertThat(rolls)
                .extracting(r -> r.get("linked"))
                .containsExactly("PENTAX PG-50", "PENTAX PG-50", "PENTAX PG-50",
                        "Mamiya RB67", "Holga", "", "",
                        "Nikon FM2", "Nikon FM2", "");

        // camera_name 這次先保留，下一支 migration 才移除；沒連上相機的卷期要靠它保留資訊
        assertThat(rolls).extracting(r -> r.get("camera_name")).contains("Mamiya RB67", "nikon fm2");
    }
}
