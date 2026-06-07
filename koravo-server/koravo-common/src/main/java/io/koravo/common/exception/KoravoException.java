package io.koravo.common.exception;

public class KoravoException extends RuntimeException {
    private final ErrorCode errorCode;

    public KoravoException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public KoravoException(ErrorCode errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }

    public ErrorCode errorCode() {
        return errorCode;
    }
}
