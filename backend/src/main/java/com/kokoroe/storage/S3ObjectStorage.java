package com.kokoroe.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.Delete;
import software.amazon.awssdk.services.s3.model.DeleteObjectsResponse;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.ObjectIdentifier;

import java.util.Collection;
import java.util.List;

/**
 * 用 S3 API 實作的 {@link ObjectStorage}，RustFS 與 Cloudflare R2 共用。
 */
public class S3ObjectStorage implements ObjectStorage {

    private static final Logger log = LoggerFactory.getLogger(S3ObjectStorage.class);

    /** S3 的 DeleteObjects 一次最多 1000 個 key。 */
    private static final int MAX_KEYS_PER_DELETE = 1000;

    private final S3Client s3;
    private final String bucket;

    public S3ObjectStorage(S3Client s3, String bucket) {
        this.s3 = s3;
        this.bucket = bucket;
    }

    @Override
    public void put(String key, byte[] content, String contentType) {
        s3.putObject(request -> request.bucket(bucket).key(key).contentType(contentType),
                RequestBody.fromBytes(content));
    }

    @Override
    public StoredObject get(String key) {
        try {
            ResponseInputStream<GetObjectResponse> stream =
                    s3.getObject(request -> request.bucket(bucket).key(key));
            return new StoredObject(stream, stream.response().contentLength());
        } catch (NoSuchKeyException ex) {
            throw new StoredObjectNotFoundException(key);
        }
    }

    @Override
    public void deleteAll(Collection<String> keys) {
        List<ObjectIdentifier> ids = keys.stream()
                .map(key -> ObjectIdentifier.builder().key(key).build())
                .toList();
        for (int from = 0; from < ids.size(); from += MAX_KEYS_PER_DELETE) {
            List<ObjectIdentifier> batch = ids.subList(from, Math.min(from + MAX_KEYS_PER_DELETE, ids.size()));
            // quiet：成功的不列出來，回應只帶失敗的項目
            DeleteObjectsResponse response = s3.deleteObjects(request -> request
                    .bucket(bucket)
                    .delete(Delete.builder().objects(batch).quiet(true).build()));
            // DeleteObjects 即使部分失敗也回 200，失敗的項目要自己看 errors
            if (!response.errors().isEmpty()) {
                throw new IllegalStateException("有 %d 個物件刪除失敗，第一個是 %s：%s".formatted(
                        response.errors().size(),
                        response.errors().getFirst().key(),
                        response.errors().getFirst().code()));
            }
            log.debug("已刪除 {} 個物件", batch.size());
        }
    }
}
