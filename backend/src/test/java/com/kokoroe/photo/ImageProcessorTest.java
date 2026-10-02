package com.kokoroe.photo;

import com.kokoroe.photo.ImageProcessor.ProcessedImage;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

@DisplayName("ImageProcessor")
class ImageProcessorTest {

    private final ImageProcessor processor = new ImageProcessor();

    @Test
    @DisplayName("橫幅照片：網頁版長邊 2048、縮圖長邊 480，比例不變")
    void shouldScaleLandscape() {
        ProcessedImage result = processor.process(TestImages.jpeg(3000, 2000));

        BufferedImage web = TestImages.decode(result.web());
        BufferedImage thumb = TestImages.decode(result.thumb());
        assertThat(web.getWidth()).isEqualTo(ImageProcessor.WEB_EDGE);
        assertThat(web.getHeight()).isCloseTo(1365, within(1));
        assertThat(thumb.getWidth()).isEqualTo(ImageProcessor.THUMB_EDGE);
        assertThat(thumb.getHeight()).isCloseTo(320, within(1));
        assertThat(result.width()).isEqualTo(3000);
        assertThat(result.height()).isEqualTo(2000);
    }

    @Test
    @DisplayName("比網頁版還小的照片不放大")
    void shouldNotUpscale() {
        ProcessedImage result = processor.process(TestImages.jpeg(800, 600));

        BufferedImage web = TestImages.decode(result.web());
        assertThat(web.getWidth()).isEqualTo(800);
        assertThat(web.getHeight()).isEqualTo(600);
        assertThat(TestImages.decode(result.thumb()).getWidth()).isEqualTo(480);
    }

    @Test
    @DisplayName("黑白底片的灰階 JPEG 也能處理")
    void shouldHandleGrayscale() {
        ProcessedImage result = processor.process(TestImages.grayJpeg(3000, 2000));

        assertThat(TestImages.decode(result.web()).getWidth()).isEqualTo(ImageProcessor.WEB_EDGE);
        assertThat(result.width()).isEqualTo(3000);
    }

    @Test
    @DisplayName("EXIF Orientation=6（需順時針轉 90°）：輸出轉正，回報的寬高也對調")
    void shouldApplyExifOrientation() {
        // 原始像素 300×200，左半紅、右半藍
        byte[] rotated = TestImages.withExifOrientation(TestImages.jpeg(300, 200), 6);

        ProcessedImage result = processor.process(rotated);

        assertThat(result.width()).isEqualTo(200);
        assertThat(result.height()).isEqualTo(300);
        BufferedImage web = TestImages.decode(result.web());
        assertThat(web.getWidth()).isEqualTo(200);
        assertThat(web.getHeight()).isEqualTo(300);
        // 順時針轉 90° 後，原本的左邊（紅）變成上面，右邊（藍）變成下面
        assertThat(isMostlyRed(web.getRGB(100, 40))).as("上半部應該是紅色").isTrue();
        assertThat(isMostlyBlue(web.getRGB(100, 260))).as("下半部應該是藍色").isTrue();
    }

    @Test
    @DisplayName("輸出的版本不帶 EXIF（去掉 GPS 等個資）")
    void shouldStripExifFromVariants() {
        byte[] input = TestImages.withExifOrientation(TestImages.jpeg(300, 200), 1);
        // 前提：輸入真的有 EXIF，否則下面的「沒有」是空話（TestImages 壞掉時測試也會一直綠）
        assertThat(containsAscii(input, "Exif")).isTrue();

        ProcessedImage result = processor.process(input);

        assertThat(containsAscii(result.web(), "Exif")).isFalse();
        assertThat(containsAscii(result.thumb(), "Exif")).isFalse();
    }

    @Test
    @DisplayName("輸出不帶任何原檔的 metadata 段落：轉向、縮放之後也一樣")
    void shouldNotLeakAnyMetadataSegment() {
        // 原檔同時有 EXIF（要轉向、會被用到）與註解段落（GPS、相機序號的替身）
        byte[] input = TestImages.withComment(
                TestImages.withExifOrientation(TestImages.jpeg(3000, 2000), 6), "SECRET-GPS-25.03N-121.56E");
        assertThat(containsAscii(input, "SECRET-GPS")).isTrue();

        ProcessedImage result = processor.process(input);

        assertThat(containsAscii(result.web(), "SECRET-GPS")).isFalse();
        assertThat(containsAscii(result.thumb(), "SECRET-GPS")).isFalse();
        assertThat(containsAscii(result.web(), "Exif")).isFalse();
        assertThat(containsAscii(result.thumb(), "Exif")).isFalse();
    }

    @ParameterizedTest(name = "Orientation={0} → {1}×{2}，紅色在{3}")
    @CsvSource({
            "1, 300, 200, LEFT",     // 正常
            "2, 300, 200, RIGHT",    // 水平鏡像
            "3, 300, 200, RIGHT",    // 轉 180°
            "4, 300, 200, LEFT",     // 垂直鏡像（左右對稱的測試圖看不出差別，但尺寸不能變）
            "5, 200, 300, TOP",      // 轉置
            "6, 200, 300, TOP",      // 順時針 90°
            "7, 200, 300, BOTTOM",   // 轉置後再轉 180°
            "8, 200, 300, BOTTOM",   // 逆時針 90°
    })
    @DisplayName("EXIF 八種方向都要轉正，網頁版與縮圖一致，回報的寬高跟著對調")
    void shouldApplyEveryExifOrientation(int orientation, int expectedWidth, int expectedHeight, String redSide) {
        // 原始像素 300×200，左半紅、右半藍。預期值是依 EXIF 規格手算的，不是從實作推出來的
        ProcessedImage result = processor.process(
                TestImages.withExifOrientation(TestImages.jpeg(300, 200), orientation));

        assertThat(result.width()).isEqualTo(expectedWidth);
        assertThat(result.height()).isEqualTo(expectedHeight);
        // 300×200 比縮圖上限小，所以網頁版與縮圖都維持原尺寸
        for (byte[] variant : new byte[][]{result.web(), result.thumb()}) {
            BufferedImage image = TestImages.decode(variant);
            assertThat(image.getWidth()).isEqualTo(expectedWidth);
            assertThat(image.getHeight()).isEqualTo(expectedHeight);
            assertThat(redSide(image)).isEqualTo(redSide);
        }
    }

    @Test
    @DisplayName("直拍的大圖：轉向與縮小一起發生，網頁版 1365×2048、縮圖 320×480，回報 2000×3000")
    void shouldRotateAndDownscaleTogether() {
        ProcessedImage result = processor.process(
                TestImages.withExifOrientation(TestImages.jpeg(3000, 2000), 6));

        assertThat(result.width()).isEqualTo(2000);
        assertThat(result.height()).isEqualTo(3000);
        BufferedImage web = TestImages.decode(result.web());
        assertThat(web.getWidth()).isCloseTo(1365, within(1));
        assertThat(web.getHeight()).isEqualTo(ImageProcessor.WEB_EDGE);
        BufferedImage thumb = TestImages.decode(result.thumb());
        assertThat(thumb.getWidth()).isCloseTo(320, within(1));
        assertThat(thumb.getHeight()).isEqualTo(ImageProcessor.THUMB_EDGE);
        assertThat(redSide(thumb)).isEqualTo("TOP");
    }

    @Test
    @DisplayName("直幅照片：長邊是高，網頁版高 2048、縮圖高 480")
    void shouldScalePortrait() {
        ProcessedImage result = processor.process(TestImages.jpeg(2000, 3000));

        BufferedImage web = TestImages.decode(result.web());
        BufferedImage thumb = TestImages.decode(result.thumb());
        assertThat(web.getHeight()).isEqualTo(ImageProcessor.WEB_EDGE);
        assertThat(web.getWidth()).isCloseTo(1365, within(1));
        assertThat(thumb.getHeight()).isEqualTo(ImageProcessor.THUMB_EDGE);
        assertThat(thumb.getWidth()).isCloseTo(320, within(1));
        assertThat(result.width()).isEqualTo(2000);
        assertThat(result.height()).isEqualTo(3000);
    }

    @Test
    @DisplayName("比縮圖上限還小的照片：網頁版與縮圖都維持原尺寸，不放大")
    void shouldNotUpscaleTinyImage() {
        ProcessedImage result = processor.process(TestImages.jpeg(300, 200));

        for (byte[] variant : new byte[][]{result.web(), result.thumb()}) {
            BufferedImage image = TestImages.decode(variant);
            assertThat(image.getWidth()).isEqualTo(300);
            assertThat(image.getHeight()).isEqualTo(200);
        }
    }

    @Test
    @DisplayName("漸進式 JPEG 也收")
    void shouldAcceptProgressiveJpeg() {
        ProcessedImage result = processor.process(TestImages.progressiveJpeg(1000, 700));

        assertThat(result.width()).isEqualTo(1000);
        assertThat(result.height()).isEqualTo(700);
        assertThat(TestImages.decode(result.thumb()).getWidth()).isEqualTo(480);
    }

    @Test
    @DisplayName("CMYK JPEG：要嘛乾淨地拒絕、要嘛產出能解碼的版本，不能讓其他例外漏出去變 500")
    void shouldHandleCmykJpegWithoutLeakingExceptions() {
        // 實測 Thumbnailator 會自己轉色彩空間而收下，所以這裡不強迫「必須拒絕」
        try {
            ProcessedImage result = processor.process(TestImages.cmykJpeg(64, 64));
            assertThat(TestImages.decode(result.web()).getWidth()).isEqualTo(64);
            assertThat(result.width()).isEqualTo(64);
        } catch (InvalidPhotoException accepted) {
            // 拒絕也是合法的結果
        }
    }

    @Test
    @DisplayName("宣稱尺寸是 0×0 的檔案：InvalidPhotoException，不是其他例外")
    void shouldRejectZeroDeclaredSize() {
        byte[] zero = TestImages.withDeclaredSize(TestImages.jpeg(64, 64), 0, 0);

        assertThatThrownBy(() -> processor.process(zero))
                .isInstanceOf(InvalidPhotoException.class);
    }

    @Test
    @DisplayName("宣稱 65500×65500（libjpeg 接受的最大尺寸，面積超過 int 範圍）：解碼前就擋下")
    void shouldRejectMaxDeclaredSize() {
        byte[] bomb = TestImages.withDeclaredSize(TestImages.jpeg(64, 64), 65_500, 65_500);

        assertThatThrownBy(() -> processor.process(bomb))
                .isInstanceOf(InvalidPhotoException.class)
                .hasMessageContaining("65500×65500");
    }

    @Test
    @DisplayName("像素上限是「含」：剛好等於上限收，多一個像素就拒絕（寬高對調也一樣）")
    void shouldAcceptExactlyMaxPixelsAndRejectOneMore() {
        ImageProcessor strict = new ImageProcessor(200 * 100);

        assertThat(strict.process(TestImages.jpeg(200, 100)).width()).isEqualTo(200);
        assertThat(strict.process(TestImages.jpeg(100, 200)).height()).isEqualTo(200);
        assertThatThrownBy(() -> strict.process(TestImages.jpeg(201, 100)))
                .isInstanceOf(InvalidPhotoException.class).hasMessageContaining("201×100");
        assertThatThrownBy(() -> strict.process(TestImages.jpeg(100, 201)))
                .isInstanceOf(InvalidPhotoException.class).hasMessageContaining("100×201");
    }

    @Test
    @DisplayName("接近正方形的大圖加上 EXIF 轉向：回報的寬高仍要對調（4097×4096 轉 90° → 4096×4097）")
    void shouldSwapDimensionsForNearSquareRotatedImage() {
        // 縮到長邊 2048 時，短邊 4096×2048/4097 = 2047.5001 會四捨五入成 2048，
        // 網頁版變成正方形，單靠「網頁版的直橫有沒有和檔頭相反」就判斷不出有沒有轉
        ProcessedImage result = processor.process(
                TestImages.withExifOrientation(TestImages.jpeg(4097, 4096), 6));

        assertThat(result.width()).isEqualTo(4096);
        assertThat(result.height()).isEqualTo(4097);
    }

    @ParameterizedTest(name = "第 {0} 個 byte 被改掉 → 不是 JPEG")
    @ValueSource(ints = {0, 1, 2})
    @DisplayName("檔頭三個 byte（FF D8 FF）每一個都要檢查")
    void shouldCheckEverySignatureByte(int index) {
        byte[] almostJpeg = TestImages.jpeg(100, 100);
        almostJpeg[index] = 0x00;

        assertThatThrownBy(() -> processor.process(almostJpeg))
                .isInstanceOf(InvalidPhotoException.class)
                .hasMessageContaining("只接受 JPEG");
    }

    @ParameterizedTest(name = "{0} 個 byte")
    @ValueSource(ints = {0, 1})
    @DisplayName("空的與只有一個 byte 的檔案：InvalidPhotoException，不是陣列越界")
    void shouldRejectEmptyAndSingleByte(int length) {
        byte[] bytes = new byte[length];
        if (length > 0) {
            bytes[0] = (byte) 0xFF;
        }

        assertThatThrownBy(() -> processor.process(bytes))
                .isInstanceOf(InvalidPhotoException.class);
    }

    @Test
    @DisplayName("PNG 不收：只看檔頭，不看副檔名或 Content-Type")
    void shouldRejectPng() {
        assertThatThrownBy(() -> processor.process(TestImages.png(100, 100)))
                .isInstanceOf(InvalidPhotoException.class)
                .hasMessageContaining("JPEG");
    }

    @Test
    @DisplayName("檔頭像 JPEG 但內容是垃圾")
    void shouldRejectGarbageWithJpegSignature() {
        byte[] garbage = new byte[1024];
        Arrays.fill(garbage, (byte) 0x41);
        garbage[0] = (byte) 0xFF;
        garbage[1] = (byte) 0xD8;
        garbage[2] = (byte) 0xFF;

        assertThatThrownBy(() -> processor.process(garbage))
                .isInstanceOf(InvalidPhotoException.class);
    }

    @Test
    @DisplayName("太短的檔案")
    void shouldRejectTinyInput() {
        assertThatThrownBy(() -> processor.process(new byte[]{(byte) 0xFF, (byte) 0xD8}))
                .isInstanceOf(InvalidPhotoException.class);
    }

    @Test
    @DisplayName("超過像素上限就拒絕")
    void shouldRejectTooManyPixels() {
        ImageProcessor strict = new ImageProcessor(10_000);

        assertThatThrownBy(() -> strict.process(TestImages.jpeg(200, 100)))
                .isInstanceOf(InvalidPhotoException.class)
                .hasMessageContaining("200×100");
    }

    @Test
    @DisplayName("解壓縮炸彈：幾 KB 的檔案宣稱 50000×50000，在解碼前就被擋下")
    void shouldRejectDecompressionBombBeforeDecoding() {
        byte[] bomb = TestImages.withDeclaredSize(TestImages.jpeg(64, 64), 50_000, 50_000);
        assertThat(bomb.length).isLessThan(10_000);

        // 預設上限的處理器；要是先解碼才檢查，這裡會配置好幾 GB 的記憶體
        assertThatThrownBy(() -> processor.process(bomb))
                .isInstanceOf(InvalidPhotoException.class)
                .hasMessageContaining("50000×50000");
    }

    /** 紅色那一半在哪一側：橫幅看左右、直幅看上下。 */
    private static String redSide(BufferedImage image) {
        int w = image.getWidth();
        int h = image.getHeight();
        if (w > h) {
            return isMostlyRed(image.getRGB(w / 4, h / 2)) ? "LEFT" : "RIGHT";
        }
        return isMostlyRed(image.getRGB(w / 2, h / 4)) ? "TOP" : "BOTTOM";
    }

    private static boolean isMostlyRed(int rgb) {
        Color c = new Color(rgb);
        return c.getRed() > 200 && c.getBlue() < 60;
    }

    private static boolean isMostlyBlue(int rgb) {
        Color c = new Color(rgb);
        return c.getBlue() > 200 && c.getRed() < 60;
    }

    @Test
    @DisplayName("EXIF 段落壞掉（宣稱是 Exif、內容太短）：照樣收下、不轉向，不能變成 500")
    void shouldTolerateCorruptExifSegment() {
        byte[] jpeg = TestImages.jpeg(300, 200);
        byte[] app1 = {(byte) 0xFF, (byte) 0xE1, 0x00, 0x09, 'E', 'x', 'i', 'f', 0x00, 0x00, 'M'};
        byte[] corrupt = new byte[jpeg.length + app1.length];
        System.arraycopy(jpeg, 0, corrupt, 0, 2);
        System.arraycopy(app1, 0, corrupt, 2, app1.length);
        System.arraycopy(jpeg, 2, corrupt, 2 + app1.length, jpeg.length - 2);

        ProcessedImage result = processor.process(corrupt);

        assertThat(result.width()).isEqualTo(300);
        assertThat(result.height()).isEqualTo(200);
    }

    private static boolean containsAscii(byte[] haystack, String needle) {
        return new String(haystack, StandardCharsets.ISO_8859_1).contains(needle);
    }
}
