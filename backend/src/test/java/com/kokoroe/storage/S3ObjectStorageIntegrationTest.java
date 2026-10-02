package com.kokoroe.storage;

import com.kokoroe.TestcontainersConfiguration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * S3ObjectStorage 對真的 S3 相容服務（RustFS）的行為：mock 驗證不到服務端怎麼回應。
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@DisplayName("S3ObjectStorage（真實 RustFS）")
class S3ObjectStorageIntegrationTest {

    @Autowired
    private ObjectStorage storage;

    private static String prefix() {
        return "storage-test/" + UUID.randomUUID() + "/";
    }

    private byte[] read(String key) throws Exception {
        try (StoredObject object = storage.get(key)) {
            byte[] bytes = object.content().readAllBytes();
            assertThat(object.contentLength()).as("Content-Length 要等於實際內容").isEqualTo(bytes.length);
            return bytes;
        }
    }

    @Test
    @DisplayName("放進去再拿出來：內容一個 byte 都不差（包含 0x00 與 0xFF）")
    void shouldRoundTripBinaryContent() throws Exception {
        String key = prefix() + "a.jpg";
        byte[] content = new byte[70_000];
        for (int i = 0; i < content.length; i++) {
            content[i] = (byte) (i * 31);
        }

        storage.put(key, content, "image/jpeg");

        assertThat(read(key)).isEqualTo(content);
    }

    @Test
    @DisplayName("同一個 key 再放一次是覆蓋")
    void shouldOverwriteExistingKey() throws Exception {
        String key = prefix() + "a.jpg";
        storage.put(key, new byte[]{1, 2, 3}, "image/jpeg");
        storage.put(key, new byte[]{9}, "image/jpeg");

        assertThat(read(key)).containsExactly(9);
    }

    @Test
    @DisplayName("拿不存在的物件：StoredObjectNotFoundException")
    void shouldThrowWhenObjectMissing() {
        assertThatThrownBy(() -> storage.get(prefix() + "nope.jpg"))
                .isInstanceOf(StoredObjectNotFoundException.class);
    }

    @Test
    @DisplayName("刪除：只刪指定的，沒指定的留著；不存在的 key 視為已刪除，不丟例外")
    void shouldDeleteOnlyRequestedKeysAndToleratesMissing() throws Exception {
        String p = prefix();
        storage.put(p + "keep.jpg", new byte[]{1}, "image/jpeg");
        storage.put(p + "gone1.jpg", new byte[]{2}, "image/jpeg");
        storage.put(p + "gone2.jpg", new byte[]{3}, "image/jpeg");

        assertThatCode(() -> storage.deleteAll(List.of(p + "gone1.jpg", p + "gone2.jpg", p + "never-existed.jpg")))
                .doesNotThrowAnyException();

        assertThat(read(p + "keep.jpg")).containsExactly(1);
        assertThatThrownBy(() -> storage.get(p + "gone1.jpg")).isInstanceOf(StoredObjectNotFoundException.class);
        assertThatThrownBy(() -> storage.get(p + "gone2.jpg")).isInstanceOf(StoredObjectNotFoundException.class);
        assertThatCode(() -> storage.deleteAll(List.of())).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("刪除超過 1000 個物件：跨批次的每一個都真的刪掉（頭、第 1000、第 1001、尾）")
    void shouldDeleteAcrossBatchBoundary() {
        String p = prefix();
        List<String> keys = IntStream.range(0, 1100).mapToObj(i -> p + i).toList();
        keys.parallelStream().forEach(key -> storage.put(key, new byte[]{1}, "image/jpeg"));

        storage.deleteAll(keys);

        for (int i : new int[]{0, 999, 1000, 1001, 1099}) {
            assertThatThrownBy(() -> storage.get(keys.get(i)))
                    .as("第 %d 個", i)
                    .isInstanceOf(StoredObjectNotFoundException.class);
        }
    }
}
