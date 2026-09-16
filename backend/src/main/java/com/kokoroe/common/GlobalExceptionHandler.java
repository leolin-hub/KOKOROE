package com.kokoroe.common;

import com.kokoroe.camera.CameraFormatConflictException;
import com.kokoroe.camera.CameraInUseException;
import com.kokoroe.camera.CameraNotFoundException;
import com.kokoroe.camera.DuplicateCameraException;
import com.kokoroe.camera.InvalidCameraException;
import com.kokoroe.filmroll.FilmRollNotFoundException;
import com.kokoroe.filmroll.IllegalStatusTransitionException;
import com.kokoroe.filmroll.InvalidFilmRollException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 全域例外處理。
 *
 * <p>統一使用 Spring 內建的 {@link ProblemDetail}（RFC 9457, application/problem+json），
 * 而不是自己土炮一個 ErrorResponse ——標準格式讓前端、API 工具、監控系統都能直接吃。
 *
 * <p><b>資安原則：</b>對外的訊息只描述「使用者能修正的事」。
 * 任何非預期例外一律吞掉細節、回一句通用訊息，stack trace 只進 log。
 * 把例外訊息直接回給 client 是很常見卻嚴重的資訊洩漏管道
 * （會暴露套件版本、SQL 結構、檔案路徑）。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private static final URI TYPE_VALIDATION = URI.create("urn:kokoroe:problem:validation-failed");
    private static final URI TYPE_NOT_FOUND = URI.create("urn:kokoroe:problem:resource-not-found");
    private static final URI TYPE_BUSINESS_RULE = URI.create("urn:kokoroe:problem:business-rule-violated");
    private static final URI TYPE_MALFORMED = URI.create("urn:kokoroe:problem:malformed-request");
    private static final URI TYPE_INTERNAL = URI.create("urn:kokoroe:problem:internal-error");

    /** Bean Validation 未通過：把每個欄位的錯誤攤平成清單，前端可直接對應到表單欄位。 */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        List<Map<String, String>> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> Map.of(
                        "field", error.getField(),
                        "message", Objects.requireNonNullElse(error.getDefaultMessage(), "欄位值不合法")))
                .toList();

        ProblemDetail problem = build(HttpStatus.BAD_REQUEST, "輸入驗證失敗",
                "有 %d 個欄位未通過驗證，詳見 errors".formatted(fieldErrors.size()), TYPE_VALIDATION);
        problem.setProperty("errors", fieldErrors);
        return problem;
    }

    @ExceptionHandler({FilmRollNotFoundException.class, CameraNotFoundException.class})
    public ProblemDetail handleNotFound(RuntimeException ex) {
        return build(HttpStatus.NOT_FOUND, "找不到資源", ex.getMessage(), TYPE_NOT_FOUND);
    }

    /** 跨欄位的商業規則違反（例如日期順序顛倒）。 */
    @ExceptionHandler({InvalidFilmRollException.class, InvalidCameraException.class})
    public ProblemDetail handleBusinessRule(RuntimeException ex) {
        return build(HttpStatus.BAD_REQUEST, "商業規則驗證失敗", ex.getMessage(), TYPE_BUSINESS_RULE);
    }

    /** 狀態流轉衝突 → 409：請求沒錯，是資源目前的狀態不允許這個操作。 */
    @ExceptionHandler(IllegalStatusTransitionException.class)
    public ProblemDetail handleIllegalTransition(IllegalStatusTransitionException ex) {
        return build(HttpStatus.CONFLICT, "狀態衝突", ex.getMessage(), TYPE_BUSINESS_RULE);
    }

    /** 與既有資料衝突 → 409：同名相機已存在、相機還有卷期在用、改片幅會讓卷期不相容。 */
    @ExceptionHandler({DuplicateCameraException.class, CameraInUseException.class,
            CameraFormatConflictException.class})
    public ProblemDetail handleResourceConflict(RuntimeException ex) {
        return build(HttpStatus.CONFLICT, "資源衝突", ex.getMessage(), TYPE_BUSINESS_RULE);
    }

    /**
     * 資料庫約束擋下的寫入（唯一索引、外鍵、CHECK）→ 409。
     *
     * <p>正常流程會先被 Service 的檢查攔下，會走到這裡通常是兩個請求同時寫入的競態。
     * 例外訊息含有約束名稱與 SQL，只寫進 log，不回給 client。
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail handleDataIntegrity(DataIntegrityViolationException ex) {
        log.warn("資料庫約束擋下寫入", ex);
        return build(HttpStatus.CONFLICT, "資源衝突",
                "資料與現有紀錄衝突，請重新整理後再試", TYPE_BUSINESS_RULE);
    }

    /**
     * JSON 解析失敗，或 enum 值不合法（例如 {@code "format": "220"}）。
     *
     * <p>只有當根因是我們自己丟的 {@link IllegalArgumentException} 時才轉述其訊息
     * （那是我們寫好、可安全外洩的說明）；其餘一律用通用訊息，
     * 避免把 Jackson 的內部型別與路徑資訊洩漏出去。
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ProblemDetail handleUnreadable(HttpMessageNotReadableException ex) {
        String detail = "請求 JSON 格式錯誤或欄位值不合法";
        if (rootCause(ex) instanceof IllegalArgumentException iae && iae.getMessage() != null) {
            detail = iae.getMessage();
        }
        log.debug("無法解析的請求內容", ex);
        return build(HttpStatus.BAD_REQUEST, "請求格式錯誤", detail, TYPE_MALFORMED);
    }

    /** 路徑參數或查詢參數型別不符，例如 {@code /film-rolls/abc} 或 {@code ?status=NOPE}。 */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ProblemDetail handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return build(HttpStatus.BAD_REQUEST, "參數型別錯誤",
                "參數 '%s' 的值不合法".formatted(ex.getName()), TYPE_MALFORMED);
    }

    /** 兜底：任何未預期的例外。完整細節只留在 log，對外只給一句通用訊息。 */
    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception ex) {
        log.error("未預期的例外", ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "伺服器內部錯誤",
                "伺服器處理請求時發生非預期的錯誤，請稍後再試", TYPE_INTERNAL);
    }

    private static ProblemDetail build(HttpStatus status, String title, String detail, URI type) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        problem.setType(type);
        problem.setProperty("timestamp", Instant.now());
        return problem;
    }

    private static Throwable rootCause(Throwable throwable) {
        Throwable current = throwable;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current;
    }
}
