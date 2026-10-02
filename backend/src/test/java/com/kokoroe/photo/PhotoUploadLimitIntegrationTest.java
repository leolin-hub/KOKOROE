package com.kokoroe.photo;

import com.kokoroe.TestcontainersConfiguration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 上傳大小上限（{@code spring.servlet.multipart.max-file-size: 40MB}）。
 *
 * <p>MockMvc 不經過 Tomcat 的 multipart 解析，不會觸發這個上限，所以要用真的 HTTP server。
 * 這個類別因此會有自己的 Spring context（RANDOM_PORT）。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
@DisplayName("上傳大小上限（真實 HTTP server）")
class PhotoUploadLimitIntegrationTest {

    private static final int FORTY_MIB = 40 * 1024 * 1024;

    @LocalServerPort
    private int port;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final HttpClient client = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }

    private long createRoll() throws Exception {
        HttpResponse<String> response = client.send(HttpRequest.newBuilder(uri("/api/v1/film-rolls"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("""
                        {"filmName": "Ilford Delta 100", "brand": "Ilford", "iso": 100,
                         "format": "135", "pushPullStops": 0, "loadedAt": "2026-03-01"}
                        """))
                .build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(201);
        return objectMapper.readTree(response.body()).get("id").asLong();
    }

    private HttpResponse<String> uploadOfSize(long rollId, int fileSize) throws Exception {
        String boundary = "----kokoroe-limit-test";
        byte[] head = ("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"big.jpg\"\r\n"
                + "Content-Type: image/jpeg\r\n\r\n").getBytes(StandardCharsets.UTF_8);
        byte[] file = new byte[fileSize];
        file[0] = (byte) 0xFF; // 有 JPEG 檔頭，才不會因為檔頭不對在別的地方被擋
        file[1] = (byte) 0xD8;
        file[2] = (byte) 0xFF;
        byte[] tail = ("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8);
        return client.send(HttpRequest.newBuilder(uri("/api/v1/film-rolls/" + rollId + "/photos"))
                        .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                        .timeout(Duration.ofSeconds(120))
                        .POST(HttpRequest.BodyPublishers.ofByteArrays(List.of(head, file, tail)))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
    }

    @Test
    @DisplayName("檔案多 1 byte 超過 40 MiB → 413 與 ProblemDetail；剛好 40 MiB 則通過大小檢查（之後因為不是 JPEG 而 400）")
    void shouldRejectOverLimitWith413() throws Exception {
        long rollId = createRoll();

        HttpResponse<String> over = uploadOfSize(rollId, FORTY_MIB + 1);
        assertThat(over.statusCode()).isEqualTo(413);
        JsonNode problem = objectMapper.readTree(over.body());
        assertThat(problem.get("status").asInt()).isEqualTo(413);
        assertThat(problem.get("title").asString()).isEqualTo("檔案太大");

        // 對照組：剛好等於上限不是 413。內容只是 0 填滿的垃圾，所以會在圖片檢查被擋成 400，而不是被大小上限擋掉
        HttpResponse<String> exact = uploadOfSize(rollId, FORTY_MIB);
        assertThat(exact.statusCode()).isEqualTo(400);

        HttpResponse<String> list = client.send(HttpRequest.newBuilder(uri("/api/v1/film-rolls/" + rollId + "/photos")).build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(list.body()).isEqualTo("[]");
    }
}
