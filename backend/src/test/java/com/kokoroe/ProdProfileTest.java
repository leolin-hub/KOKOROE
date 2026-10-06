package com.kokoroe;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code application-prod.yml} 不能有開發用的預設值（localhost、kokoroe/kokoroe、RustFS 的金鑰）。
 *
 * <p>直接讀 YAML 檢查每一個值，不啟動 Spring：
 * <ul>
 *   <li>Spring 綁定設定時遇到解析不了的 {@code ${VAR}} 不會報錯，而是把字面字串原樣留下，
 *       所以「啟動失敗」只能證明第一個被用到的值沒有預設，後面的密碼、金鑰加回預設值也抓不到。</li>
 *   <li>不依賴本機有沒有開著開發資料庫、有沒有設環境變數。</li>
 * </ul>
 * 「漏設就拒絕啟動」的實際防線是 {@code deploy/compose.prod.yml} 的 {@code ${VAR:?}}。
 */
@DisplayName("application-prod.yml")
class ProdProfileTest {

    private static PropertySource<?> prod;

    @BeforeAll
    static void loadProdYaml() throws IOException {
        prod = new YamlPropertySourceLoader()
                .load("prod", new ClassPathResource("application-prod.yml"))
                .getFirst();
    }

    private static String value(String key) {
        Object raw = prod.getProperty(key);
        assertThat(raw).as("application-prod.yml 缺少 %s", key).isNotNull();
        return raw.toString();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "spring.datasource.username", "spring.datasource.password",
            "kokoroe.storage.endpoint", "kokoroe.storage.bucket",
            "kokoroe.storage.access-key", "kokoroe.storage.secret-key"})
    @DisplayName("帳號、密碼、儲存位置與金鑰只能是沒有預設值的 ${VAR}")
    void credentialsHaveNoDefault(String key) {
        assertThat(value(key)).matches("\\$\\{[A-Z_]+}");
    }

    @Test
    @DisplayName("資料庫網址的主機與資料庫名稱沒有預設值（port 可以預設 5432）")
    void datasourceUrlHasNoHostDefault() {
        assertThat(value("spring.datasource.url"))
                .contains("${DB_HOST}", "${DB_NAME}")
                .doesNotContain("localhost");
    }

    @Test
    @DisplayName("不自動建立 bucket，log 等級是 info")
    void productionBehaviour() {
        assertThat(value("kokoroe.storage.create-bucket")).isEqualTo("false");
        assertThat(value("logging.level.com.kokoroe")).isEqualTo("info");
    }
}
