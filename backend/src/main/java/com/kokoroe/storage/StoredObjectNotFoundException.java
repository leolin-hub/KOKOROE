package com.kokoroe.storage;

/**
 * 儲存空間裡找不到指定的物件。
 *
 * <p>正常情況下不會發生（資料庫有紀錄就一定有檔案），出現時代表兩邊不同步，
 * 例如有人手動到儲存空間刪了檔案。訊息只含 key，不含 bucket 或端點。
 */
public class StoredObjectNotFoundException extends RuntimeException {

    public StoredObjectNotFoundException(String key) {
        super("儲存空間裡找不到物件 " + key);
    }
}
