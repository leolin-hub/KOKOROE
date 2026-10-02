package com.kokoroe.storage;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectsResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Error;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * S3ObjectStorage 與 AWS SDK 之間的接線：bucket、key、content type 有沒有送對，
 * 批次刪除有沒有切在 S3 的 1000 個 key 上限內，部分失敗有沒有被看見。
 * 與真正的 RustFS 來回在 {@code PhotoIntegrationTest} 與 {@code S3ObjectStorageIntegrationTest} 驗證。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("S3ObjectStorage（mock S3Client）")
class S3ObjectStorageTest {

    @Mock
    private S3Client s3;

    private S3ObjectStorage storage;

    @BeforeEach
    void setUp() {
        storage = new S3ObjectStorage(s3, "my-bucket");
    }

    @SuppressWarnings("unchecked")
    private List<DeleteObjectsRequest> captureDeleteRequests(int expectedCalls) {
        ArgumentCaptor<Consumer<DeleteObjectsRequest.Builder>> captor = ArgumentCaptor.forClass(Consumer.class);
        verify(s3, times(expectedCalls)).deleteObjects(captor.capture());
        return captor.getAllValues().stream().map(consumer -> {
            DeleteObjectsRequest.Builder builder = DeleteObjectsRequest.builder();
            consumer.accept(builder);
            return builder.build();
        }).toList();
    }

    @SuppressWarnings("unchecked")
    private void stubDeleteSucceeds() {
        when(s3.deleteObjects(any(Consumer.class))).thenReturn(DeleteObjectsResponse.builder().build());
    }

    @Test
    @DisplayName("put：bucket、key、content type 都送對，內容原樣")
    @SuppressWarnings("unchecked")
    void shouldPutWithBucketKeyAndContentType() throws IOException {
        byte[] content = {1, 2, 3, 4};

        storage.put("rolls/7/abc/original.jpg", content, "image/jpeg");

        ArgumentCaptor<Consumer<PutObjectRequest.Builder>> request = ArgumentCaptor.forClass(Consumer.class);
        ArgumentCaptor<RequestBody> body = ArgumentCaptor.forClass(RequestBody.class);
        verify(s3).putObject(request.capture(), body.capture());
        PutObjectRequest.Builder builder = PutObjectRequest.builder();
        request.getValue().accept(builder);
        PutObjectRequest sent = builder.build();
        assertThat(sent.bucket()).isEqualTo("my-bucket");
        assertThat(sent.key()).isEqualTo("rolls/7/abc/original.jpg");
        assertThat(sent.contentType()).isEqualTo("image/jpeg");
        try (var stream = body.getValue().contentStreamProvider().newStream()) {
            assertThat(stream.readAllBytes()).isEqualTo(content);
        }
    }

    @Test
    @DisplayName("deleteAll：2500 個 key 切成 1000 + 1000 + 500 三批，每個 key 恰好送出一次、順序不變")
    void shouldSplitDeleteIntoBatchesOfAtMost1000() {
        stubDeleteSucceeds();
        List<String> keys = IntStream.range(0, 2500).mapToObj(i -> "k/" + i).toList();

        storage.deleteAll(keys);

        List<DeleteObjectsRequest> requests = captureDeleteRequests(3);
        assertThat(requests).extracting(r -> r.delete().objects().size()).containsExactly(1000, 1000, 500);
        List<String> sent = new ArrayList<>();
        requests.forEach(r -> r.delete().objects().forEach(id -> sent.add(id.key())));
        assertThat(sent).isEqualTo(keys);
    }

    @Test
    @DisplayName("deleteAll：剛好 1000 個只送一批")
    void shouldSplitAtExactBoundary() {
        stubDeleteSucceeds();

        storage.deleteAll(IntStream.range(0, 1000).mapToObj(i -> "k/" + i).toList());
        assertThat(captureDeleteRequests(1)).extracting(r -> r.delete().objects().size()).containsExactly(1000);
    }

    @Test
    @DisplayName("deleteAll：1001 個 key 送兩批，第二批只有一個")
    void shouldSendOneExtraBatchForThe1001stKey() {
        stubDeleteSucceeds();

        storage.deleteAll(IntStream.range(0, 1001).mapToObj(i -> "k/" + i).toList());

        assertThat(captureDeleteRequests(2)).extracting(r -> r.delete().objects().size()).containsExactly(1000, 1);
    }

    @Test
    @DisplayName("deleteAll：用 quiet 模式並指定 bucket")
    void shouldDeleteQuietlyFromBucket() {
        stubDeleteSucceeds();

        storage.deleteAll(List.of("a", "b"));

        DeleteObjectsRequest request = captureDeleteRequests(1).getFirst();
        assertThat(request.bucket()).isEqualTo("my-bucket");
        assertThat(request.delete().quiet()).isTrue();
    }

    @Test
    @DisplayName("deleteAll：沒有 key 就不呼叫 S3")
    @SuppressWarnings("unchecked")
    void shouldNotCallS3ForEmptyKeys() {
        storage.deleteAll(List.of());

        verify(s3, never()).deleteObjects(any(DeleteObjectsRequest.class));
        verify(s3, never()).deleteObjects(any(Consumer.class));
    }

    @Test
    @DisplayName("deleteAll：S3 回 200 但有部分物件刪除失敗，要丟出例外（說出失敗幾個、第一個是誰），而且不再繼續下一批")
    @SuppressWarnings("unchecked")
    void shouldFailLoudlyOnPartialFailure() {
        DeleteObjectsResponse partial = DeleteObjectsResponse.builder()
                .errors(S3Error.builder().key("k/3").code("AccessDenied").build(),
                        S3Error.builder().key("k/9").code("InternalError").build())
                .build();
        when(s3.deleteObjects(any(Consumer.class))).thenReturn(partial);
        List<String> keys = IntStream.range(0, 1500).mapToObj(i -> "k/" + i).toList();

        assertThatThrownBy(() -> storage.deleteAll(keys))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("有 2 個物件")
                .hasMessageContaining("k/3")
                .hasMessageContaining("AccessDenied");

        verify(s3, times(1)).deleteObjects(any(Consumer.class));
    }
}
