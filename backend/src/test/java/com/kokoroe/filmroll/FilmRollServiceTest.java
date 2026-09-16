package com.kokoroe.filmroll;

import com.kokoroe.camera.Camera;
import com.kokoroe.camera.CameraFormat;
import com.kokoroe.camera.CameraRepository;
import com.kokoroe.filmroll.dto.CreateFilmRollRequest;
import com.kokoroe.filmroll.dto.FilmRollResponse;
import com.kokoroe.filmroll.dto.UpdateFilmRollRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Service 層單元測試：Repository 全部 mock 掉，不碰資料庫，毫秒級跑完。
 * 這一層驗證的是「規則對不對」，而不是「SQL 通不通」——後者交給整合測試。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("FilmRollService")
class FilmRollServiceTest {

    private static final LocalDate LOADED_ON = LocalDate.of(2026, 3, 1);

    @Mock
    private FilmRollRepository filmRollRepository;

    @Mock
    private CameraRepository cameraRepository;

    @InjectMocks
    private FilmRollService filmRollService;

    // ------------------------------------------------------------------
    // 測試資料工廠
    // ------------------------------------------------------------------

    private static Camera camera(Long id, String model, CameraFormat format) {
        return Camera.builder().id(id).brand("Nikon").model(model).format(format).build();
    }

    private static FilmRoll existingRoll(Long id, FilmRollStatus status) {
        return FilmRoll.builder()
                .id(id)
                .filmName("Kodak Portra 400")
                .brand("Kodak")
                .iso(400)
                .format(FilmFormat.FORMAT_135)
                .pushPullStops(0)
                .loadedAt(LOADED_ON)
                .status(status)
                .build();
    }

    private static UpdateFilmRollRequest updateRequestWith(FilmRollStatus status, LocalDate finishedAt) {
        return updateRequestWith(status, finishedAt, null);
    }

    private static UpdateFilmRollRequest updateRequestWith(FilmRollStatus status, LocalDate finishedAt,
                                                           Long cameraId) {
        return new UpdateFilmRollRequest("Kodak Portra 400", "Kodak", 400, FilmFormat.FORMAT_135,
                0, LOADED_ON, finishedAt, cameraId, "50mm f/1.4", null, status);
    }

    @Nested
    @DisplayName("create")
    class Create {

        @Test
        @DisplayName("應把請求轉為實體存檔，並回傳對應的 Response")
        void shouldPersistAndReturnResponse() {
            CreateFilmRollRequest request = new CreateFilmRollRequest(
                    "Lomography 400", "Lomography", 400, FilmFormat.FORMAT_135,
                    1, LOADED_ON, null, 7L, "50mm f/1.4", "第一卷", null);

            when(cameraRepository.findById(7L))
                    .thenReturn(Optional.of(camera(7L, "FM2", CameraFormat.FORMAT_135)));
            when(filmRollRepository.save(any(FilmRoll.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            FilmRollResponse response = filmRollService.create(request);

            ArgumentCaptor<FilmRoll> captor = ArgumentCaptor.forClass(FilmRoll.class);
            verify(filmRollRepository).save(captor.capture());

            assertThat(captor.getValue().getFilmName()).isEqualTo("Lomography 400");
            assertThat(captor.getValue().getPushPullStops()).isEqualTo(1);
            assertThat(response.filmName()).isEqualTo("Lomography 400");
            assertThat(response.camera().id()).isEqualTo(7L);
            assertThat(response.camera().name()).isEqualTo("Nikon FM2");
            // status 未指定時，DTO 的 compact constructor 應補上 LOADED
            assertThat(response.status()).isEqualTo(FilmRollStatus.LOADED);
        }

        @Test
        @DisplayName("拍完日期早於裝片日期時應拒絕，且不得寫入資料庫")
        void shouldRejectFinishedBeforeLoaded() {
            CreateFilmRollRequest request = new CreateFilmRollRequest(
                    "Kodak Gold 200", "Kodak", 200, FilmFormat.FORMAT_135,
                    0, LOADED_ON, LOADED_ON.minusDays(1), null, null, null, null);

            assertThatThrownBy(() -> filmRollService.create(request))
                    .isInstanceOf(InvalidFilmRollException.class)
                    .hasMessageContaining("不可早於裝片日期");

            verify(filmRollRepository, never()).save(any());
        }

        @Test
        @DisplayName("指定不存在的相機應回 400 類的例外，且不得寫入資料庫")
        void shouldRejectUnknownCamera() {
            CreateFilmRollRequest request = new CreateFilmRollRequest(
                    "Kodak Gold 200", "Kodak", 200, FilmFormat.FORMAT_135,
                    0, LOADED_ON, null, 404L, null, null, null);
            when(cameraRepository.findById(404L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> filmRollService.create(request))
                    .isInstanceOf(InvalidFilmRollException.class)
                    .hasMessageContaining("404");

            verify(filmRollRepository, never()).save(any());
        }

        @Test
        @DisplayName("120 相機不能裝 135 底片")
        void shouldRejectIncompatibleCamera() {
            CreateFilmRollRequest request = new CreateFilmRollRequest(
                    "Kodak Gold 200", "Kodak", 200, FilmFormat.FORMAT_135,
                    0, LOADED_ON, null, 8L, null, null, null);
            when(cameraRepository.findById(8L))
                    .thenReturn(Optional.of(camera(8L, "RB67", CameraFormat.FORMAT_120)));

            assertThatThrownBy(() -> filmRollService.create(request))
                    .isInstanceOf(InvalidFilmRollException.class)
                    .hasMessageContaining("120");

            verify(filmRollRepository, never()).save(any());
        }

        @Test
        @DisplayName("半格機裝的是 135 底片，應允許")
        void shouldAcceptHalfFrameCameraWith135Film() {
            CreateFilmRollRequest request = new CreateFilmRollRequest(
                    "Kodak Gold 200", "Kodak", 200, FilmFormat.FORMAT_135,
                    0, LOADED_ON, null, 9L, null, null, null);
            when(cameraRepository.findById(9L))
                    .thenReturn(Optional.of(camera(9L, "Pen EE", CameraFormat.HALF_FRAME)));
            when(filmRollRepository.save(any(FilmRoll.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            assertThat(filmRollService.create(request).camera().id()).isEqualTo(9L);
        }
    }

    @Nested
    @DisplayName("getById / delete")
    class Lookup {

        @Test
        @DisplayName("查無資料應丟 FilmRollNotFoundException（而非回傳 null 或 Optional）")
        void shouldThrowWhenNotFound() {
            when(filmRollRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> filmRollService.getById(999L))
                    .isInstanceOf(FilmRollNotFoundException.class)
                    .hasMessageContaining("999");
        }

        @Test
        @DisplayName("刪除不存在的資料應丟 404 例外，而不是靜默成功")
        void shouldThrowWhenDeletingMissing() {
            when(filmRollRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> filmRollService.delete(999L))
                    .isInstanceOf(FilmRollNotFoundException.class);

            verify(filmRollRepository, never()).delete(any());
        }
    }

    @Nested
    @DisplayName("update")
    class Update {

        @Test
        @DisplayName("正常更新應寫回欄位並 flush 以取得最新的 updatedAt")
        void shouldApplyChanges() {
            FilmRoll existing = existingRoll(1L, FilmRollStatus.SHOOTING);
            when(filmRollRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(filmRollRepository.saveAndFlush(any(FilmRoll.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            FilmRollResponse response = filmRollService.update(
                    1L, updateRequestWith(FilmRollStatus.DEVELOPING, LOADED_ON.plusDays(20)));

            assertThat(response.status()).isEqualTo(FilmRollStatus.DEVELOPING);
            assertThat(response.finishedAt()).isEqualTo(LOADED_ON.plusDays(20));
            assertThat(response.lensName()).isEqualTo("50mm f/1.4");
            verify(filmRollRepository).saveAndFlush(existing);
        }

        @Test
        @DisplayName("同時換相機與底片規格時，應以新的規格判斷相容性")
        void shouldCheckCameraAgainstNewFormat() {
            FilmRoll existing = existingRoll(1L, FilmRollStatus.SHOOTING);
            when(filmRollRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(cameraRepository.findById(8L))
                    .thenReturn(Optional.of(camera(8L, "RB67", CameraFormat.FORMAT_120)));
            when(filmRollRepository.saveAndFlush(any(FilmRoll.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            UpdateFilmRollRequest request = new UpdateFilmRollRequest("Kodak Portra 400", "Kodak", 400,
                    FilmFormat.FORMAT_120, 0, LOADED_ON, null, 8L, null, null, FilmRollStatus.SHOOTING);

            FilmRollResponse response = filmRollService.update(1L, request);

            assertThat(response.format()).isEqualTo(FilmFormat.FORMAT_120);
            assertThat(response.camera().name()).isEqualTo("Nikon RB67");
        }

        @Test
        @DisplayName("逆向狀態流轉應被拒絕，且不得寫入資料庫")
        void shouldRejectBackwardTransition() {
            when(filmRollRepository.findById(1L))
                    .thenReturn(Optional.of(existingRoll(1L, FilmRollStatus.ARCHIVED)));

            assertThatThrownBy(() -> filmRollService.update(
                    1L, updateRequestWith(FilmRollStatus.SHOOTING, null)))
                    .isInstanceOf(IllegalStatusTransitionException.class)
                    .hasMessageContaining("ARCHIVED");

            verify(filmRollRepository, never()).saveAndFlush(any());
        }

        @Test
        @DisplayName("日期順序不合法時應在寫入前就擋下")
        void shouldRejectInvalidDates() {
            when(filmRollRepository.findById(1L))
                    .thenReturn(Optional.of(existingRoll(1L, FilmRollStatus.SHOOTING)));

            assertThatThrownBy(() -> filmRollService.update(
                    1L, updateRequestWith(FilmRollStatus.SHOOTING, LOADED_ON.minusDays(5))))
                    .isInstanceOf(InvalidFilmRollException.class);

            verify(filmRollRepository, never()).saveAndFlush(any());
        }
    }

    @Nested
    @DisplayName("list")
    class ListRolls {

        private final Pageable pageable = PageRequest.of(0, 20);

        @Test
        @DisplayName("未指定狀態時走 findAll")
        void shouldUseFindAllWhenNoFilter() {
            when(filmRollRepository.findAll(pageable))
                    .thenReturn(new PageImpl<>(List.of(existingRoll(1L, FilmRollStatus.SHOOTING)), pageable, 1));

            var result = filmRollService.list(null, pageable);

            assertThat(result.content()).hasSize(1);
            assertThat(result.totalElements()).isEqualTo(1);
            assertThat(result.first()).isTrue();
            assertThat(result.last()).isTrue();
            verify(filmRollRepository, never()).findByStatus(any(), any());
        }

        @Test
        @DisplayName("指定狀態時應改走 findByStatus，不可在記憶體中過濾")
        void shouldUseFindByStatusWhenFiltered() {
            when(filmRollRepository.findByStatus(FilmRollStatus.ARCHIVED, pageable))
                    .thenReturn(new PageImpl<>(List.of(), pageable, 0));

            var result = filmRollService.list(FilmRollStatus.ARCHIVED, pageable);

            assertThat(result.content()).isEmpty();
            verify(filmRollRepository, never()).findAll(pageable);
        }
    }
}
