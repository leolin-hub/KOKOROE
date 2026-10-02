package com.kokoroe.storage;

import java.util.Collection;

/**
 * 物件儲存的最小介面：放、拿、刪。
 *
 * <p>照片的商業邏輯只認識這個介面，不認識 AWS SDK。好處有兩個：
 * 換儲存服務時只動實作；寫 Service 單元測試時 mock 這三個方法就好，不用 mock 一整個 S3Client。
 */
public interface ObjectStorage {

    void put(String key, byte[] content, String contentType);

    /**
     * 開啟物件內容。呼叫端負責關閉回傳的 {@link StoredObject}。
     *
     * @throws StoredObjectNotFoundException 物件不存在
     */
    StoredObject get(String key);

    /** 一次刪除多個物件。不存在的 key 視為已刪除，不算錯誤。 */
    void deleteAll(Collection<String> keys);
}
