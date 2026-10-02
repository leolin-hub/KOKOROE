package com.kokoroe.common;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponseException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 兜底 handler 的分流：Spring 自己的 4xx 保留狀態碼與標頭，其餘（包含 5xx 的 ErrorResponse）一律是 500 通用訊息。
 * 各個 HTTP 例外對應到的狀態碼在 PhotoControllerTest 與各整合測試裡走過完整的 MVC 流程；
 * 這裡只補「4xx 與 5xx 的分界」，那個分界很難從外面湊出一個真實請求來觸發。
 */
@DisplayName("GlobalExceptionHandler 兜底分流")
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    @DisplayName("ErrorResponse 的 4xx：保留狀態碼與標頭，body 是 ProblemDetail")
    void shouldPassThroughClientErrorWithHeaders() {
        ErrorResponseException ex = new ErrorResponseException(HttpStatus.METHOD_NOT_ALLOWED);
        ex.getHeaders().add(HttpHeaders.ALLOW, "GET,DELETE");
        ex.setDetail("Method 'POST' is not supported.");

        ResponseEntity<ProblemDetail> response = handler.handleUnexpected(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.METHOD_NOT_ALLOWED);
        assertThat(response.getHeaders().getFirst(HttpHeaders.ALLOW)).isEqualTo("GET,DELETE");
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getStatus()).isEqualTo(405);
        assertThat(response.getBody().getTitle()).isEqualTo("請求無法處理");
        assertThat(response.getBody().getDetail()).isEqualTo("Method 'POST' is not supported.");
        assertThat(response.getBody().getType().toString()).isEqualTo("urn:kokoroe:problem:malformed-request");
    }

    @Test
    @DisplayName("ErrorResponse 的 5xx 不照搬：一律 500 與通用訊息，內部說明不外洩")
    void shouldNotPassThroughServerErrorResponse() {
        ErrorResponseException ex = new ErrorResponseException(HttpStatus.BAD_GATEWAY);
        ex.setDetail("upstream http://10.0.0.5:9000 refused the connection");
        ex.getHeaders().add("X-Internal", "secret");

        ResponseEntity<ProblemDetail> response = handler.handleUnexpected(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getHeaders().containsHeader("X-Internal")).isFalse();
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getStatus()).isEqualTo(500);
        assertThat(response.getBody().getTitle()).isEqualTo("伺服器內部錯誤");
        assertThat(response.getBody().getDetail()).doesNotContain("10.0.0.5");
    }

    @Test
    @DisplayName("一般例外：500 與通用訊息，例外內容不外洩")
    void shouldHideDetailsOfUnexpectedException() {
        ResponseEntity<ProblemDetail> response =
                handler.handleUnexpected(new IllegalStateException("jdbc:postgresql://db:5432 password=hunter2"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getDetail()).doesNotContain("hunter2");
        assertThat(response.getBody().getType().toString()).isEqualTo("urn:kokoroe:problem:internal-error");
    }
}
