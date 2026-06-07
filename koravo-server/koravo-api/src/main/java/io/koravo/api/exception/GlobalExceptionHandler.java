package io.koravo.api.exception;

import io.koravo.common.api.ApiResponse;
import io.koravo.common.exception.ErrorCode;
import io.koravo.common.exception.KoravoException;
import io.koravo.common.web.RequestContextHolder;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(KoravoException.class)
    public ResponseEntity<ApiResponse<Void>> handleKoravoException(KoravoException ex) {
        return ResponseEntity.badRequest().body(ApiResponse.error(ex.errorCode(), ex.getMessage()));
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, ConstraintViolationException.class, IllegalArgumentException.class})
    public ResponseEntity<ApiResponse<Void>> handleBadRequest(Exception ex) {
        return ResponseEntity.badRequest().body(ApiResponse.error(ErrorCode.BAD_REQUEST, readableBadRequestMessage(ex)));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception ex) {
        log.error("Unhandled request error, requestId={}", RequestContextHolder.getRequestId(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(ErrorCode.INTERNAL_ERROR, ErrorCode.INTERNAL_ERROR.message()));
    }

    private String readableBadRequestMessage(Exception ex) {
        if (ex instanceof MethodArgumentNotValidException invalid) {
            FieldError fieldError = invalid.getBindingResult().getFieldError();
            if (fieldError != null) {
                return "请求参数无效：" + fieldError.getField() + " " + fieldError.getDefaultMessage();
            }
        }
        if (ex instanceof ConstraintViolationException violation) {
            return "请求参数无效：" + violation.getMessage();
        }
        return ex.getMessage() == null || ex.getMessage().isBlank() ? ErrorCode.BAD_REQUEST.message() : ex.getMessage();
    }
}
