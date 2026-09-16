package com.kokoroe.camera;

import com.kokoroe.camera.dto.CameraResponse;
import com.kokoroe.camera.dto.CreateCameraRequest;
import com.kokoroe.camera.dto.UpdateCameraRequest;
import com.kokoroe.filmroll.FilmFormat;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Service 層單元測試，慣例同 {@code FilmRollServiceTest}。 */
@ExtendWith(MockitoExtension.class)
@DisplayName("CameraService")
class CameraServiceTest {

    @Mock
    private CameraRepository cameraRepository;

    @InjectMocks
    private CameraService cameraService;

    private static CreateCameraRequest createRequest(String brand, String model,
                                                     Boolean interchangeableLens, String fixedLens,
                                                     Integer isoMin, Integer isoMax) {
        return new CreateCameraRequest(brand, model, CameraFormat.FORMAT_135,
                CameraType.POINT_AND_SHOOT, FocusType.AUTO, FilmAdvance.AUTO, true,
                interchangeableLens, fixedLens, null, isoMin, isoMax, null);
    }

    private static UpdateCameraRequest updateRequest(String brand, String model) {
        return new UpdateCameraRequest(brand, model, CameraFormat.FORMAT_135,
                null, null, null, null, null, null, null, null, null, null);
    }

    private static Camera existingCamera(Long id) {
        return Camera.builder().id(id).brand("PENTAX").model("PG-50").format(CameraFormat.FORMAT_135).build();
    }

    @Nested
    @DisplayName("create")
    class Create {

        @Test
        @DisplayName("應先正規化名稱再檢查重複與存檔")
        void shouldNormalizeNamesBeforeSaving() {
            when(cameraRepository.existsDuplicate("PENTAX", "PG-50", null)).thenReturn(false);
            when(cameraRepository.save(any(Camera.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            CameraResponse response = cameraService.create(
                    createRequest("  PENTAX ", "PG-50", false, "35mm f/4.5", 100, 400));

            assertThat(response.brand()).isEqualTo("PENTAX");
            assertThat(response.name()).isEqualTo("PENTAX PG-50");
            assertThat(response.fixedLens()).isEqualTo("35mm f/4.5");
        }

        @Test
        @DisplayName("品牌是空白字串時視為沒有品牌，顯示名稱只有型號")
        void shouldTreatBlankBrandAsNull() {
            when(cameraRepository.existsDuplicate(isNull(), anyString(), isNull())).thenReturn(false);
            when(cameraRepository.save(any(Camera.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            CameraResponse response = cameraService.create(
                    createRequest("   ", "Holga  120N", null, null, null, null));

            assertThat(response.brand()).isNull();
            assertThat(response.name()).isEqualTo("Holga 120N");
        }

        @Test
        @DisplayName("同名相機已存在時應拒絕，且不得寫入資料庫")
        void shouldRejectDuplicate() {
            when(cameraRepository.existsDuplicate("PENTAX", "PG-50", null)).thenReturn(true);

            assertThatThrownBy(() -> cameraService.create(
                    createRequest("PENTAX", "PG-50", null, null, null, null)))
                    .isInstanceOf(DuplicateCameraException.class)
                    .hasMessageContaining("PENTAX PG-50");

            verify(cameraRepository, never()).save(any());
        }

        @Test
        @DisplayName("可換鏡頭的機身不應填定焦鏡頭")
        void shouldRejectFixedLensOnInterchangeableBody() {
            assertThatThrownBy(() -> cameraService.create(
                    createRequest("Nikon", "FM2", true, "50mm f/1.4", null, null)))
                    .isInstanceOf(InvalidCameraException.class);

            verify(cameraRepository, never()).save(any());
        }

        @Test
        @DisplayName("ISO 下限大於上限應拒絕")
        void shouldRejectInvertedIsoRange() {
            assertThatThrownBy(() -> cameraService.create(
                    createRequest("PENTAX", "PG-50", false, null, 400, 100)))
                    .isInstanceOf(InvalidCameraException.class)
                    .hasMessageContaining("400");

            verify(cameraRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("update")
    class Update {

        @Test
        @DisplayName("檢查重複時應排除自己，改大小寫不算重複")
        void shouldExcludeSelfWhenCheckingDuplicate() {
            Camera existing = existingCamera(1L);
            when(cameraRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(cameraRepository.existsDuplicate("Pentax", "PG-50", 1L)).thenReturn(false);
            when(cameraRepository.saveAndFlush(existing)).thenReturn(existing);

            CameraResponse response = cameraService.update(1L, updateRequest("Pentax", "PG-50"));

            assertThat(response.name()).isEqualTo("Pentax PG-50");
        }

        @Test
        @DisplayName("改成與另一台相機同名時應拒絕，且實體不得被修改")
        void shouldRejectRenameToExistingCamera() {
            Camera existing = existingCamera(1L);
            when(cameraRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(cameraRepository.existsDuplicate("Nikon", "FM2", 1L)).thenReturn(true);

            assertThatThrownBy(() -> cameraService.update(1L, updateRequest("Nikon", "FM2")))
                    .isInstanceOf(DuplicateCameraException.class);

            assertThat(existing.getDisplayName()).isEqualTo("PENTAX PG-50");
            verify(cameraRepository, never()).saveAndFlush(any());
        }

        @Test
        @DisplayName("還有 135 卷期時不能把相機改成 120，且實體不得被修改")
        void shouldRejectFormatChangeThatBreaksRolls() {
            Camera existing = existingCamera(1L);
            when(cameraRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(cameraRepository.existsDuplicate("PENTAX", "PG-50", 1L)).thenReturn(false);
            when(cameraRepository.countFilmRollsWithOtherFormat(1L, FilmFormat.FORMAT_120)).thenReturn(2L);

            UpdateCameraRequest request = new UpdateCameraRequest("PENTAX", "PG-50", CameraFormat.FORMAT_120,
                    null, null, null, null, null, null, null, null, null, null);

            assertThatThrownBy(() -> cameraService.update(1L, request))
                    .isInstanceOf(CameraFormatConflictException.class)
                    .hasMessageContaining("2 卷");

            assertThat(existing.getFormat()).isEqualTo(CameraFormat.FORMAT_135);
            verify(cameraRepository, never()).saveAndFlush(any());
        }

        @Test
        @DisplayName("135 改成半格不影響底片規格，卷期都相容時應允許")
        void shouldAllowFormatChangeCompatibleWithRolls() {
            Camera existing = existingCamera(1L);
            when(cameraRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(cameraRepository.existsDuplicate("PENTAX", "PG-50", 1L)).thenReturn(false);
            when(cameraRepository.countFilmRollsWithOtherFormat(1L, FilmFormat.FORMAT_135)).thenReturn(0L);
            when(cameraRepository.saveAndFlush(existing)).thenReturn(existing);

            UpdateCameraRequest request = new UpdateCameraRequest("PENTAX", "PG-50", CameraFormat.HALF_FRAME,
                    null, null, null, null, null, null, null, null, null, null);

            assertThat(cameraService.update(1L, request).format()).isEqualTo(CameraFormat.HALF_FRAME);
        }

        @Test
        @DisplayName("片幅沒變時不必查卷期")
        void shouldSkipRollCheckWhenFormatUnchanged() {
            Camera existing = existingCamera(1L);
            when(cameraRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(cameraRepository.existsDuplicate("PENTAX", "PG-50", 1L)).thenReturn(false);
            when(cameraRepository.saveAndFlush(existing)).thenReturn(existing);

            cameraService.update(1L, updateRequest("PENTAX", "PG-50"));

            verify(cameraRepository, never()).countFilmRollsWithOtherFormat(anyLong(), any());
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {

        @Test
        @DisplayName("還有卷期使用中時應拒絕刪除")
        void shouldRejectWhenInUse() {
            when(cameraRepository.findById(1L)).thenReturn(Optional.of(existingCamera(1L)));
            when(cameraRepository.countFilmRollsUsing(1L)).thenReturn(3L);

            assertThatThrownBy(() -> cameraService.delete(1L))
                    .isInstanceOf(CameraInUseException.class)
                    .hasMessageContaining("PENTAX PG-50")
                    .hasMessageContaining("3 卷");

            verify(cameraRepository, never()).delete(any());
        }

        @Test
        @DisplayName("刪除不存在的相機應丟 404 例外")
        void shouldThrowWhenMissing() {
            when(cameraRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> cameraService.delete(999L))
                    .isInstanceOf(CameraNotFoundException.class);

            verify(cameraRepository, never()).countFilmRollsUsing(anyLong());
        }
    }
}
