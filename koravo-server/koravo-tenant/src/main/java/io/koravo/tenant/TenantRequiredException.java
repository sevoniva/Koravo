package io.koravo.tenant;

import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;

public class TenantRequiredException extends BusinessException {
    public TenantRequiredException() {
        super(ErrorCode.TENANT_REQUIRED, ErrorCode.TENANT_REQUIRED.message());
    }
}
