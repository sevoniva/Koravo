package io.koravo.datahub.service;

import io.koravo.common.api.PageResult;
import io.koravo.datahub.domain.KoDataSource;
import io.koravo.datahub.domain.KoDataSourceTestLog;
import io.koravo.datahub.dto.DataSourceTestLogResponse;
import io.koravo.datahub.repo.DataSourceTestLogRepository;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class DataSourceTestLogService {
    private final DataSourceTestLogRepository repository;

    public DataSourceTestLogService(DataSourceTestLogRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void record(KoDataSource dataSource, boolean success, String message, long elapsedMillis) {
        KoDataSourceTestLog log = new KoDataSourceTestLog();
        log.setTenantId(dataSource.getTenantId());
        log.setCreatedBy(UserContextHolder.getUserId());
        log.setUpdatedBy(UserContextHolder.getUserId());
        log.setDatasourceId(dataSource.getId());
        log.setSuccess(success);
        log.setMessage(redact(message));
        log.setElapsedMillis(elapsedMillis);
        repository.save(log);
    }

    @Transactional(readOnly = true)
    public PageResult<DataSourceTestLogResponse> list(String datasourceId, int page, int pageSize) {
        int safePage = Math.max(page, 1);
        int safePageSize = Math.min(Math.max(pageSize, 1), 100);
        var result = repository.findByTenantIdAndDatasourceIdOrderByCreatedAtDesc(
                TenantContextHolder.getTenantId(),
                datasourceId,
                PageRequest.of(safePage - 1, safePageSize)
        );
        return PageResult.of(
                result.getContent().stream().map(this::toResponse).toList(),
                result.getTotalElements(),
                safePage,
                safePageSize
        );
    }

    private DataSourceTestLogResponse toResponse(KoDataSourceTestLog log) {
        return new DataSourceTestLogResponse(
                log.getId(),
                log.getDatasourceId(),
                log.isSuccess(),
                redact(log.getMessage()),
                log.getElapsedMillis(),
                log.getCreatedAt()
        );
    }

    private String redact(String message) {
        if (!StringUtils.hasText(message)) {
            return message;
        }
        return message.replaceAll("(?i)(password|token|secret)\\s*=\\s*[^\\s,;]+", "$1=***");
    }
}
