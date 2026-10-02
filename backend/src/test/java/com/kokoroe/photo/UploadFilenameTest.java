package com.kokoroe.photo;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("UploadFilename")
class UploadFilenameTest {

    @Nested
    @DisplayName("frameNumber：取檔名最後一組數字當格號")
    class FrameNumber {

        @ParameterizedTest(name = "{0} → 第 {1} 格")
        @CsvSource({
                "000123_01.jpg, 1",
                "000123_36.JPG, 36",
                "R1-00001-0012.jpg, 12",
                "roll3-frame7.jpeg, 7",
                "00.jpg, 0",
                "000123_00.jpg, 0",
                "12A.jpg, 12",
                "99.jpg, 99",
                "0.jpg, 0",
                "000.jpg, 0",          // 全是零：去掉前導零後要留一個 0，不能變成空字串
                "0099.jpg, 99",        // 先去前導零再比大小，四位數的 0099 仍是第 99 格
                "台北_底片_05.jpg, 5",  // 非 ASCII 檔名
                "roll 2 frame 17 .JPG, 17",
        })
        void shouldParseLastDigitGroup(String filename, int expected) {
            assertThat(UploadFilename.frameNumber(filename)).hasValue(expected);
        }

        @ParameterizedTest(name = "{0} → 推不出格號")
        @ValueSource(strings = {
                "scan.jpg",            // 沒有數字
                "IMG_4521.jpg",        // 相機流水號，超過 99
                "100.jpg",             // 剛好超過上限
                "0100.jpg",            // 去掉前導零後是 100
                "000123_999999999999999999999.jpg", // 超長數字不能溢位
                "frame.2024.jpg",      // 數字在副檔名前一段，但 > 99
                ".jpg",
        })
        void shouldRejectOutOfRange(String filename) {
            assertThat(UploadFilename.frameNumber(filename)).isEmpty();
        }

        @Test
        @DisplayName("副檔名裡的數字不算（.mp4 這種）")
        void shouldIgnoreDigitsInExtension() {
            assertThat(UploadFilename.frameNumber("scan.mp4")).isEmpty();
        }
    }

    @Nested
    @DisplayName("displayName：只留檔名、去掉控制字元、截斷長度")
    class CleanDisplayName {

        @Test
        @DisplayName("去掉 Windows 與 Unix 路徑")
        void shouldStripPaths() {
            assertThat(UploadFilename.displayName("C:\\Users\\leo\\scans\\01.jpg")).hasValue("01.jpg");
            assertThat(UploadFilename.displayName("../../etc/01.jpg")).hasValue("01.jpg");
            // 兩種分隔符號混用：要取最後一個，不論是哪一種
            assertThat(UploadFilename.displayName("dir/sub\\01.jpg")).hasValue("01.jpg");
            assertThat(UploadFilename.displayName("dir\\sub/01.jpg")).hasValue("01.jpg");
        }

        @Test
        @DisplayName("前後空白去掉，中文檔名原樣保留")
        void shouldStripSurroundingWhitespaceButKeepCjk() {
            assertThat(UploadFilename.displayName("  01.jpg \t")).hasValue("01.jpg");
            assertThat(UploadFilename.displayName("台北 底片 05.jpg")).hasValue("台北 底片 05.jpg");
        }

        @Test
        @DisplayName("去掉換行等控制字元，避免偽造 log")
        void shouldStripControlCharacters() {
            assertThat(UploadFilename.displayName("01\r\nFAKE LOG.jpg")).hasValue("01FAKE LOG.jpg");
        }

        @Test
        @DisplayName("去掉看不見的 Unicode 格式字元（RTL 覆寫會讓檔名顯示成別的樣子）")
        void shouldStripInvisibleFormatCharacters() {
            assertThat(UploadFilename.displayName("photo‮gpj.exe")).hasValue("photogpj.exe");
            assertThat(UploadFilename.displayName("a​b c.jpg")).hasValue("abc.jpg");
        }

        @Test
        @DisplayName("截斷時不能把 emoji 從中間切開")
        void shouldTruncateOnCodePoints() {
            String emojis = "📷".repeat(300);

            String name = UploadFilename.displayName(emojis).orElseThrow();

            // 寫死 255：對應 V4 的 VARCHAR(255)。拿常數跟自己比，常數被改大測試也不會發現
            assertThat(name.codePointCount(0, name.length())).isEqualTo(255);
            assertThat(Character.isHighSurrogate(name.charAt(name.length() - 1))).isFalse();
        }

        @Test
        @DisplayName("超過欄位長度就截斷，不讓資料庫寫入失敗")
        void shouldTruncate() {
            String longName = "a".repeat(300) + ".jpg";
            assertThat(UploadFilename.displayName(longName)).hasValueSatisfying(
                    name -> assertThat(name).hasSize(255).isEqualTo("a".repeat(255)));
            // 剛好 255 個字元不動
            assertThat(UploadFilename.displayName("b".repeat(255))).hasValue("b".repeat(255));
        }

        @ParameterizedTest
        @ValueSource(strings = {"", "   ", "dir/", "\t"})
        @DisplayName("清完是空字串時當作沒有檔名")
        void shouldTreatBlankAsMissing(String original) {
            assertThat(UploadFilename.displayName(original)).isEmpty();
        }

        @Test
        void shouldTreatNullAsMissing() {
            assertThat(UploadFilename.displayName(null)).isEmpty();
        }
    }
}
