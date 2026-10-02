package com.kokoroe.storage;

import java.io.Closeable;
import java.io.IOException;
import java.io.InputStream;

/**
 * 從儲存空間讀出來的物件。內容是串流而不是 {@code byte[]}：
 * 原圖可能有幾十 MB，邊讀邊寫回 HTTP 回應，就不必整個載入記憶體。
 */
public record StoredObject(InputStream content, long contentLength) implements Closeable {

    @Override
    public void close() throws IOException {
        content.close();
    }
}
