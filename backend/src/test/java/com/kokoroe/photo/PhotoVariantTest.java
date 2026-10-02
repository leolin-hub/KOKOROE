package com.kokoroe.photo;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("PhotoVariant")
class PhotoVariantTest {

    @Test
    @DisplayName("儲存空間裡的檔名是固定的三個（改了的話，已經存在的照片就全找不到了）")
    void shouldMapToFixedFileNames() {
        assertThat(PhotoVariant.THUMB.fileName()).isEqualTo("thumb.jpg");
        assertThat(PhotoVariant.WEB.fileName()).isEqualTo("web.jpg");
        assertThat(PhotoVariant.ORIGINAL.fileName()).isEqualTo("original.jpg");
        assertThat(PhotoVariant.values()).hasSize(3);
    }

    @ParameterizedTest
    @ValueSource(strings = {"thumb", "web", "original", "THUMB", "Web", "oRiGiNaL"})
    @DisplayName("網址片段不分大小寫")
    void shouldParseCaseInsensitively(String segment) {
        assertThat(PhotoVariant.fromPathSegment(segment).name()).isEqualToIgnoringCase(segment);
    }

    @ParameterizedTest
    @ValueSource(strings = {"large", "", " thumb", "thumb.jpg", "../original", "thumb%00"})
    @DisplayName("不是三個版本之一就丟 IllegalArgumentException（由 MVC 轉成 400）")
    void shouldRejectUnknownSegment(String segment) {
        assertThatThrownBy(() -> PhotoVariant.fromPathSegment(segment))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("伺服器語系是土耳其文也不能出錯：original 的 i 不能變成 İ，檔名不能出現 ı")
    void shouldNotDependOnDefaultLocale() {
        Locale previous = Locale.getDefault();
        try {
            Locale.setDefault(Locale.forLanguageTag("tr-TR"));

            // 前提：這個語系下一般的 toUpperCase / toLowerCase 真的會出事，否則測試沒有意義
            assertThat("original".toUpperCase()).isNotEqualTo("ORIGINAL");

            assertThat(PhotoVariant.fromPathSegment("original")).isEqualTo(PhotoVariant.ORIGINAL);
            assertThat(PhotoVariant.ORIGINAL.fileName()).isEqualTo("original.jpg");
        } finally {
            Locale.setDefault(previous);
        }
    }
}
