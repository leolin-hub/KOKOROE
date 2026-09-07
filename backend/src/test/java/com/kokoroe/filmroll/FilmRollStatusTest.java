package com.kokoroe.filmroll;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 狀態流轉規則的窮舉測試。
 *
 * <p>這條規則是純函式、沒有任何相依，所以可以用極低成本做到 100% 覆蓋 ——
 * 這正是把商業規則抽成純函式的價值所在。
 */
@DisplayName("FilmRollStatus 狀態流轉規則")
class FilmRollStatusTest {

    @Nested
    @DisplayName("允許的流轉")
    class Allowed {

        @ParameterizedTest
        @EnumSource(FilmRollStatus.class)
        @DisplayName("維持原狀態一律允許（更新其他欄位時不該被狀態規則擋下）")
        void shouldAllowStayingInSameStatus(FilmRollStatus status) {
            assertThat(status.canTransitionTo(status)).isTrue();
        }

        @Test
        @DisplayName("依序向前推進：裝片 → 拍攝 → 送洗 → 歸檔")
        void shouldAllowForwardProgression() {
            assertThat(FilmRollStatus.LOADED.canTransitionTo(FilmRollStatus.SHOOTING)).isTrue();
            assertThat(FilmRollStatus.SHOOTING.canTransitionTo(FilmRollStatus.DEVELOPING)).isTrue();
            assertThat(FilmRollStatus.DEVELOPING.canTransitionTo(FilmRollStatus.ARCHIVED)).isTrue();
        }

        @Test
        @DisplayName("允許跳關：這卷片報銷了，從裝片中直接歸檔")
        void shouldAllowSkippingForward() {
            assertThat(FilmRollStatus.LOADED.canTransitionTo(FilmRollStatus.ARCHIVED)).isTrue();
            assertThat(FilmRollStatus.LOADED.canTransitionTo(FilmRollStatus.DEVELOPING)).isTrue();
            assertThat(FilmRollStatus.SHOOTING.canTransitionTo(FilmRollStatus.ARCHIVED)).isTrue();
        }
    }

    @Nested
    @DisplayName("禁止的流轉")
    class Rejected {

        @Test
        @DisplayName("不可逆向：已歸檔不能回到任何較早的狀態")
        void shouldRejectBackwardFromArchived() {
            assertThat(FilmRollStatus.ARCHIVED.canTransitionTo(FilmRollStatus.DEVELOPING)).isFalse();
            assertThat(FilmRollStatus.ARCHIVED.canTransitionTo(FilmRollStatus.SHOOTING)).isFalse();
            assertThat(FilmRollStatus.ARCHIVED.canTransitionTo(FilmRollStatus.LOADED)).isFalse();
        }

        @Test
        @DisplayName("不可逆向：送洗中 / 拍攝中同樣不能倒退")
        void shouldRejectBackwardFromMiddleStates() {
            assertThat(FilmRollStatus.DEVELOPING.canTransitionTo(FilmRollStatus.SHOOTING)).isFalse();
            assertThat(FilmRollStatus.DEVELOPING.canTransitionTo(FilmRollStatus.LOADED)).isFalse();
            assertThat(FilmRollStatus.SHOOTING.canTransitionTo(FilmRollStatus.LOADED)).isFalse();
        }

        @ParameterizedTest
        @EnumSource(FilmRollStatus.class)
        @DisplayName("目標為 null 時一律拒絕，不可拋 NullPointerException")
        void shouldRejectNullTarget(FilmRollStatus status) {
            assertThat(status.canTransitionTo(null)).isFalse();
        }
    }
}
