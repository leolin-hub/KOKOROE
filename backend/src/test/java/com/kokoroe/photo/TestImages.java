package com.kokoroe.photo;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.awt.image.DataBuffer;
import java.awt.image.Raster;
import java.awt.image.WritableRaster;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;

/**
 * 測試用的圖片：在記憶體裡現畫現編碼，不必把圖檔放進 repo。
 *
 * <p>左半紅、右半藍，轉向測試靠它判斷照片是往哪個方向轉的。
 */
final class TestImages {

    private TestImages() {
    }

    static byte[] jpeg(int width, int height) {
        return encode(halfRedHalfBlue(width, height, BufferedImage.TYPE_INT_RGB), "jpg");
    }

    /** 黑白底片的掃描檔通常是單通道灰階 JPEG。 */
    static byte[] grayJpeg(int width, int height) {
        return encode(halfRedHalfBlue(width, height, BufferedImage.TYPE_BYTE_GRAY), "jpg");
    }

    /** 漸進式（progressive）JPEG：Lightroom、Photoshop 匯出常見，SOF 標記是 SOF2 而不是 SOF0。 */
    static byte[] progressiveJpeg(int width, int height) {
        try {
            ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setProgressiveMode(ImageWriteParam.MODE_DEFAULT);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (ImageOutputStream ios = ImageIO.createImageOutputStream(out)) {
                writer.setOutput(ios);
                writer.write(null, new IIOImage(halfRedHalfBlue(width, height, BufferedImage.TYPE_INT_RGB), null, null), param);
            } finally {
                writer.dispose();
            }
            return out.toByteArray();
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    /** 四個通道（CMYK）的 JPEG：Java 的 ImageIO 讀得到檔頭、卻解不出像素。 */
    static byte[] cmykJpeg(int width, int height) {
        try {
            ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
            WritableRaster raster = Raster.createInterleavedRaster(DataBuffer.TYPE_BYTE, width, height, 4, null);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (ImageOutputStream ios = ImageIO.createImageOutputStream(out)) {
                writer.setOutput(ios);
                writer.write(null, new IIOImage(raster, null, null), writer.getDefaultWriteParam());
            } finally {
                writer.dispose();
            }
            return out.toByteArray();
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    static byte[] png(int width, int height) {
        return encode(halfRedHalfBlue(width, height, BufferedImage.TYPE_INT_RGB), "png");
    }

    /**
     * 在 SOI 後面插入一段只含 Orientation 標籤的 EXIF（APP1）。
     *
     * <p>結構：{@code FF E1} + 長度 + {@code "Exif\0\0"} + TIFF 檔頭（big-endian）+ 只有一個欄位的 IFD0。
     */
    static byte[] withExifOrientation(byte[] jpeg, int orientation) {
        byte[] app1 = {
                (byte) 0xFF, (byte) 0xE1, 0x00, 0x22,             // APP1，長度 34（含這兩個 byte）
                'E', 'x', 'i', 'f', 0x00, 0x00,
                'M', 'M', 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08,     // big-endian，IFD0 在 offset 8
                0x00, 0x01,                                       // 1 個欄位
                0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01,   // tag 0x0112 Orientation，SHORT，1 個
                0x00, (byte) orientation, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00                            // 沒有下一個 IFD
        };
        byte[] result = new byte[jpeg.length + app1.length];
        System.arraycopy(jpeg, 0, result, 0, 2);
        System.arraycopy(app1, 0, result, 2, app1.length);
        System.arraycopy(jpeg, 2, result, 2 + app1.length, jpeg.length - 2);
        return result;
    }

    /**
     * 在 SOI 後面插入一段 COM（註解）段落。真實照片的 GPS、相機序號等個資放在 EXIF/XMP，
     * 測試裡用 COM 當替身：只要輸出的檔案沒有任何額外的 metadata 段落，這串文字就不會出現。
     */
    static byte[] withComment(byte[] jpeg, String comment) {
        byte[] text = comment.getBytes(java.nio.charset.StandardCharsets.ISO_8859_1);
        int length = text.length + 2; // 長度欄位本身算在內
        byte[] result = new byte[jpeg.length + 4 + text.length];
        System.arraycopy(jpeg, 0, result, 0, 2);
        result[2] = (byte) 0xFF;
        result[3] = (byte) 0xFE;
        result[4] = (byte) (length >> 8);
        result[5] = (byte) length;
        System.arraycopy(text, 0, result, 6, text.length);
        System.arraycopy(jpeg, 2, result, 6 + text.length, jpeg.length - 2);
        return result;
    }

    /**
     * 把 SOF0 段落裡的寬高改成指定值，像素資料不動。
     * 做出「檔案很小、卻宣稱自己非常大」的解壓縮炸彈。
     */
    static byte[] withDeclaredSize(byte[] jpeg, int width, int height) {
        byte[] patched = jpeg.clone();
        for (int i = 2; i < patched.length - 9; i++) {
            if ((patched[i] & 0xFF) == 0xFF && (patched[i + 1] & 0xFF) == 0xC0) {
                // FF C0 | 長度(2) | 精度(1) | 高(2) | 寬(2)
                patched[i + 5] = (byte) (height >> 8);
                patched[i + 6] = (byte) height;
                patched[i + 7] = (byte) (width >> 8);
                patched[i + 8] = (byte) width;
                return patched;
            }
        }
        throw new IllegalStateException("找不到 SOF0 段落");
    }

    static BufferedImage decode(byte[] bytes) {
        try {
            return ImageIO.read(new ByteArrayInputStream(bytes));
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    private static BufferedImage halfRedHalfBlue(int width, int height, int type) {
        BufferedImage image = new BufferedImage(width, height, type);
        Graphics2D g = image.createGraphics();
        g.setColor(Color.RED);
        g.fillRect(0, 0, width / 2, height);
        g.setColor(Color.BLUE);
        g.fillRect(width / 2, 0, width - width / 2, height);
        g.dispose();
        return image;
    }

    private static byte[] encode(BufferedImage image, String format) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            if (!ImageIO.write(image, format, out)) {
                throw new IllegalStateException("沒有 " + format + " 編碼器");
            }
            return out.toByteArray();
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }
}
