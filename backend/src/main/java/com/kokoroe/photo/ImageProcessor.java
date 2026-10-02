package com.kokoroe.photo;

import net.coobird.thumbnailator.Thumbnails;
import net.coobird.thumbnailator.util.exif.ExifUtils;
import net.coobird.thumbnailator.util.exif.Orientation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.MemoryCacheImageInputStream;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.Iterator;
import java.util.Set;

/**
 * 檢查上傳的檔案，並產生縮圖與網頁版。
 *
 * <h2>檢查順序（由便宜到昂貴）</h2>
 * <ol>
 *   <li>前三個 byte 是不是 JPEG 的檔頭 {@code FF D8 FF}。不看副檔名或 Content-Type，那兩個都是 client 說了算。</li>
 *   <li>只讀檔頭取得寬高，<b>不解碼</b>。超過 {@link #DEFAULT_MAX_PIXELS} 就拒絕。
 *       解壓縮炸彈（幾 KB 的檔案宣稱自己是 50000×50000）在這一步就擋下來，不會吃光記憶體。</li>
 *   <li>真正解碼並縮圖。完全解不開的檔案算不合法。
 *       注意 ImageIO 很寬容：被截斷一半的 JPEG 會把缺的部分補成灰色照樣收下，這是刻意接受的
 *       （沖印店給的檔不會這樣；真遇到了，使用者看得到、刪掉重傳就好）。</li>
 * </ol>
 *
 * <p>原圖只解碼一次：先縮成網頁版，再從網頁版縮出縮圖。
 * Thumbnailator 會依 EXIF Orientation 把照片轉正，輸出的 JPEG 不帶 EXIF（順便去掉 GPS 等個資）。
 * 原檔另外原封不動保存，不經過這裡。
 */
@Component
public class ImageProcessor {

    static final int THUMB_EDGE = 480;
    static final int WEB_EDGE = 2048;

    /**
     * 4000 萬像素：沖印店掃描的最高解析度約 3000 萬像素（Noritsu / Frontier 135 最大檔），留一些餘裕。
     * 實測處理一張這麼大的照片，heap 尖峰約 200 MB；同時處理幾張由 {@code PhotoService} 控制。
     */
    static final long DEFAULT_MAX_PIXELS = 40_000_000L;

    private static final float THUMB_QUALITY = 0.8f;
    private static final float WEB_QUALITY = 0.85f;

    // 刻意「不」呼叫 ImageIO.setUseCache(false)：試過之後 Thumbnailator 就不再套用 EXIF 方向，
    // 直拍的掃描檔會躺著（ImageProcessorTest.shouldApplyExifOrientation 會抓到）。
    // ImageIO 因此會在暫存目錄寫快取檔，但 Tomcat 本來就把上傳檔暫存在那裡，容器反正要給可寫的 /tmp。
    private static final Logger log = LoggerFactory.getLogger(ImageProcessor.class);

    private final long maxPixels;

    public ImageProcessor() {
        this(DEFAULT_MAX_PIXELS);
    }

    /** 給測試用：不用真的做一張 4000 萬像素的圖，也能測到上限。 */
    ImageProcessor(long maxPixels) {
        this.maxPixels = maxPixels;
    }

    /**
     * @param width  依 EXIF 轉正後的原圖寬度
     * @param height 依 EXIF 轉正後的原圖高度
     */
    public record ProcessedImage(byte[] thumb, byte[] web, int width, int height) {
    }

    /**
     * @throws InvalidPhotoException 不是 JPEG、尺寸超過上限、或無法解碼
     */
    public ProcessedImage process(byte[] original) {
        if (!hasJpegSignature(original)) {
            throw new InvalidPhotoException("只接受 JPEG 檔");
        }
        Header header = readHeader(original);
        if ((long) header.width() * header.height() > maxPixels) {
            throw new InvalidPhotoException("照片尺寸 %d×%d 超過上限（%d 萬像素）"
                    .formatted(header.width(), header.height(), maxPixels / 10_000));
        }

        try {
            BufferedImage web = Thumbnails.of(new ByteArrayInputStream(original))
                    .scale(scaleToFit(header.width(), header.height(), WEB_EDGE))
                    // 統一成 RGB：預設可能帶 alpha 通道，JPEG 編碼器不吃
                    .imageType(BufferedImage.TYPE_INT_RGB)
                    .asBufferedImage();
            BufferedImage thumb = Thumbnails.of(web)
                    .scale(scaleToFit(web.getWidth(), web.getHeight(), THUMB_EDGE))
                    .imageType(BufferedImage.TYPE_INT_RGB)
                    .asBufferedImage();

            // EXIF 要求轉 90° 時，轉正後的寬高與檔頭寫的相反
            return new ProcessedImage(
                    encodeJpeg(thumb, THUMB_QUALITY),
                    encodeJpeg(web, WEB_QUALITY),
                    header.quarterTurn() ? header.height() : header.width(),
                    header.quarterTurn() ? header.width() : header.height());
        } catch (IOException | RuntimeException ex) {
            // ImageIO 對壞檔會丟 IOException，也可能丟 IllegalArgumentException 等執行期例外。
            // 對使用者一律說檔案有問題；真正的原因寫進 log，萬一是我們自己的 bug 才查得到
            log.warn("照片解碼或縮圖失敗", ex);
            throw new InvalidPhotoException("無法讀取這張照片，檔案可能已損壞或是不支援的 JPEG 格式");
        }
    }

    private static boolean hasJpegSignature(byte[] bytes) {
        return bytes.length >= 3
                && (bytes[0] & 0xFF) == 0xFF
                && (bytes[1] & 0xFF) == 0xD8
                && (bytes[2] & 0xFF) == 0xFF;
    }

    /**
     * @param width       檔頭寫的寬度（尚未依 EXIF 轉正）
     * @param height      檔頭寫的高度
     * @param quarterTurn EXIF 是否要求轉 90° 或 270°（轉正後寬高對調）
     */
    private record Header(int width, int height, boolean quarterTurn) {
    }

    /** 轉正需要轉 90° / 270° 的四種 EXIF 方向（5–8）。 */
    private static final Set<Orientation> QUARTER_TURNS = EnumSet.of(
            Orientation.LEFT_TOP, Orientation.RIGHT_TOP, Orientation.RIGHT_BOTTOM, Orientation.LEFT_BOTTOM);

    /**
     * 只解析檔頭取得寬高與 EXIF 方向，不解碼像素。
     *
     * <p>方向不能從縮好的網頁版反推：4097×4096 這種接近正方形的照片，縮小後四捨五入成正方形，
     * 就看不出有沒有轉過了。
     */
    private static Header readHeader(byte[] bytes) {
        try (ImageInputStream input = new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw new InvalidPhotoException("無法辨識的圖片格式");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                return new Header(reader.getWidth(0), reader.getHeight(0), needsQuarterTurn(bytes));
            } finally {
                reader.dispose();
            }
        } catch (IOException ex) {
            log.debug("讀取照片尺寸失敗", ex);
            throw new InvalidPhotoException("無法讀取這張照片的尺寸，檔案可能已損壞");
        }
    }

    /**
     * EXIF 方向是否要求轉 90° / 270°。
     *
     * <p>用 Thumbnailator 判斷轉向的同一支 {@link ExifUtils} 解析，兩邊的結論才會一致。
     * 不透過 ImageIO 的中繼資料：EXIF 段落排在 JFIF 前面時 ImageIO 會直接拒讀，Thumbnailator 也是自己找段落。
     * 解析失敗（EXIF 內容壞掉）就當作不用轉：Thumbnailator 那邊同樣會放棄轉向。
     */
    private static boolean needsQuarterTurn(byte[] jpeg) {
        byte[] exif = findExifSegment(jpeg);
        if (exif == null) {
            return false;
        }
        try {
            Orientation orientation = ExifUtils.getOrientationFromExif(exif);
            return orientation != null && QUARTER_TURNS.contains(orientation);
        } catch (RuntimeException ex) {
            log.debug("EXIF 內容無法解析，當作不用轉向", ex);
            return false;
        }
    }

    /**
     * 找出 APP1 EXIF 段落的內容（從 {@code "Exif\0\0"} 開始），沒有就回 null。
     *
     * <p>JPEG 檔頭是一串段落：{@code FF} + 標記 + 兩 byte 長度（含長度本身）+ 內容。
     * 只掃到 SOS（{@code FF DA}，影像資料開始）為止，長度不合理就停，不會讀出陣列範圍。
     */
    private static byte[] findExifSegment(byte[] jpeg) {
        int i = 2; // 跳過 SOI（FF D8）
        while (i + 4 <= jpeg.length && (jpeg[i] & 0xFF) == 0xFF) {
            int marker = jpeg[i + 1] & 0xFF;
            if (marker == 0xFF) { // 段落之間允許的填充 byte
                i++;
                continue;
            }
            if (marker == 0xDA || marker == 0xD9) { // SOS 或 EOI：檔頭結束
                return null;
            }
            int length = ((jpeg[i + 2] & 0xFF) << 8) | (jpeg[i + 3] & 0xFF);
            int end = i + 2 + length;
            if (length < 2 || end > jpeg.length) {
                return null;
            }
            if (marker == 0xE1 && length >= 8
                    && jpeg[i + 4] == 'E' && jpeg[i + 5] == 'x' && jpeg[i + 6] == 'i' && jpeg[i + 7] == 'f') {
                return Arrays.copyOfRange(jpeg, i + 4, end);
            }
            i = end;
        }
        return null;
    }

    /** 長邊縮到 {@code edge}；本來就比較小的照片不放大。 */
    private static double scaleToFit(int width, int height, int edge) {
        return Math.min(1.0, (double) edge / Math.max(width, height));
    }

    private static byte[] encodeJpeg(BufferedImage image, float quality) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Thumbnails.of(image)
                .scale(1.0)
                .outputFormat("jpg")
                .outputQuality(quality)
                .toOutputStream(out);
        return out.toByteArray();
    }
}
