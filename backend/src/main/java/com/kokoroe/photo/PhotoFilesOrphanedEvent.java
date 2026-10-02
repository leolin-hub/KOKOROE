package com.kokoroe.photo;

import java.util.List;

/**
 * 這些照片的資料庫紀錄已刪除（或即將隨交易提交而刪除），儲存空間裡的檔案該清掉了。
 *
 * @param storageKeys 每張照片的 storage key（前綴），不是個別物件的 key
 */
public record PhotoFilesOrphanedEvent(List<String> storageKeys) {
}
