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
 * 相機相關 migration（V2 搬遷、V3 移除舊欄位）的資料測試。
 *
 * <p>應用程式啟動時 Flyway 已經把所有 migration 一口氣跑完，那時資料表是空的，驗證不到搬遷邏輯。
 * 所以這裡在同一個容器裡另開一個 schema，手動控制 Flyway：
 * 先只跑到舊版本 → 塞入當時格式的資料 → 再跑下一版 → 檢查結果。
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@DisplayName("相機 migration：V2 搬遷 camera_name、V3 移除舊欄位")
class CameraMigrationTest {

    private static final String SCHEMA = "migration_camera_test";

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
        insertRoll(cameraName, format, null);
    }

    private void insertRoll(String cameraName, String format, String notes) {
        jdbc.update("""
                INSERT INTO %s.film_roll (film_name, iso, format, loaded_at, camera_name, notes, status, created_at, updated_at)
                VALUES ('Kodak Gold 200', 200, ?, DATE '2026-03-01', ?, ?, 'LOADED', now(), now())
                """.formatted(SCHEMA), format, cameraName, notes);
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

    @Test
    @DisplayName("V3 應把沒連上相機的舊名稱補進備註再刪欄位，使用者自己清掉相機的卷期不補")
    void shouldPreserveUnlinkedCameraNamesBeforeDroppingColumn() {
        flywayUpTo("1").migrate();

        // 135 要佔多數（3 比 2），V2 建立的相機才會是 135 片幅；平手時 mode() 會取排序在前的 FORMAT_120
        insertRoll("Nikon FM2", "FORMAT_135");                 // id 1：V2 連上
        insertRoll("Nikon FM2", "FORMAT_135");                 // id 2：V2 連上，之後使用者改成「不指定」
        insertRoll("nikon fm2", "FORMAT_120", null);           // id 3：規格不合沒連上，沒有備註
        insertRoll("Nikon  FM2", "FORMAT_120", "過期兩年");     // id 4：規格不合沒連上，已有備註
        insertRoll("  ", "FORMAT_135", "空白名稱");             // id 5：沒填相機，不應動到備註
        insertRoll("Nikon FM2", "FORMAT_135");                 // id 6：V2 連上

        flywayUpTo("2").migrate();
        jdbc.update("UPDATE %s.film_roll SET camera_id = NULL WHERE id = 2".formatted(SCHEMA));

        flywayUpTo("3").migrate();

        List<Map<String, Object>> rolls = jdbc.queryForList(
                "SELECT id, camera_id, notes FROM %s.film_roll ORDER BY id".formatted(SCHEMA));
        assertThat(rolls)
                .extracting(r -> r.get("camera_id") != null, r -> r.get("notes"))
                .containsExactly(
                        tuple(true, null),
                        tuple(false, null),
                        tuple(false, "原相機紀錄：nikon fm2"),
                        tuple(false, "過期兩年\n原相機紀錄：Nikon  FM2"),
                        tuple(false, "空白名稱"),
                        tuple(true, null));

        Integer remaining = jdbc.queryForObject("""
                SELECT count(*) FROM information_schema.columns
                WHERE table_schema = ? AND table_name = 'film_roll' AND column_name = 'camera_name'
                """, Integer.class, SCHEMA);
        assertThat(remaining).isZero();
    }
}
