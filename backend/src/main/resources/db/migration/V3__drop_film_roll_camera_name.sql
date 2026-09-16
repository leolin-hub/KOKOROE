-- Kokoroe V3: 移除 film_roll.camera_name
--
-- V2 已經把相機名稱搬進 camera 表並回填 camera_id，應用程式也不再讀寫這個欄位。
--
-- 刪欄位前先處理一種情況：V2 因為「底片規格與相機片幅不同」而沒連上相機的卷期，
-- 它的相機名稱只存在 camera_name 裡，直接刪欄位就永遠消失了。
-- 這些卷期的名稱補進備註最後一行（「原相機紀錄：…」），使用者之後可以照著選回正確的相機。
--
-- 判斷條件是「沒有任何相機的名稱與片幅都對得上」，而不只是 camera_id IS NULL：
-- V2 之後使用者自己把相機改成「不指定」的卷期，camera_name 還留著舊值，
-- 但對應的相機存在、片幅也相同，那是使用者刻意清掉的，不該再把名稱塞回備註。
--
-- 注意：應用層限制備註最多 2000 字。原本就接近上限的備註補上這一行後可能超過，
-- 那一卷下次儲存時會在備註欄看到錯誤，需要手動刪減。寧可讓使用者刪字，也不在這裡截斷資料。

UPDATE film_roll fr
SET notes = CASE
                WHEN fr.notes IS NULL OR btrim(fr.notes) = '' THEN '原相機紀錄：' || btrim(fr.camera_name)
                ELSE fr.notes || E'\n原相機紀錄：' || btrim(fr.camera_name)
            END
WHERE fr.camera_id IS NULL
  AND btrim(coalesce(fr.camera_name, '')) <> ''
  AND NOT EXISTS (
      SELECT 1
      FROM camera c
      -- 名稱正規化規則與 V2 相同
      WHERE lower(btrim(regexp_replace(fr.camera_name, '\s+', ' ', 'g'))) = lower(concat_ws(' ', c.brand, c.model))
        AND c.format = fr.format
  );

ALTER TABLE film_roll DROP COLUMN camera_name;
