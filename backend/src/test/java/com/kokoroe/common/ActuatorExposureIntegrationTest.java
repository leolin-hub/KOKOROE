package com.kokoroe.common;

import com.kokoroe.TestcontainersConfiguration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.aMapWithSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Actuator 只能露出 health，而且只回狀態。
 *
 * <p>容器 healthcheck 與外部監控靠 {@code /actuator/health}；其他端點一旦被打開
 * （例如有人把 exposure 改成 {@code *}），密碼與記憶體內容就會外流，所以要有測試擋著。
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@DisplayName("Actuator 端點曝露範圍")
class ActuatorExposureIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("/actuator/health 回 UP，而且只有 status 一個欄位（沒有 details、components、groups）")
    void healthIsUpWithoutDetails() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$", aMapWithSize(1)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/actuator", "/actuator/env", "/actuator/configprops",
            "/actuator/heapdump", "/actuator/beans", "/actuator/health/db"})
    @DisplayName("health 以外的端點、health 的子項目都不存在")
    void otherEndpointsAreNotExposed(String path) throws Exception {
        mockMvc.perform(get(path))
                .andExpect(status().isNotFound());
    }
}
