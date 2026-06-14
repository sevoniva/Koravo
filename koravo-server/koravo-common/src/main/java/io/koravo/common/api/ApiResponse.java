package io.koravo.common.api;

import io.koravo.common.exception.ErrorCode;
import io.koravo.common.web.RequestContextHolder;

public record ApiResponse<T>(
        boolean success,
        String code,
        String message,
        T data,
        String requestId
) {
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, ErrorCode.OK.code(), ErrorCode.OK.message(), data, RequestContextHolder.getRequestId());
    }

    public static <T> ApiResponse<T> error(ErrorCode errorCode, String message) {
        return new ApiResponse<>(false, errorCode.code(), message, null, RequestContextHolder.getRequestId());
    }
}
