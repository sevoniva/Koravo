package io.koravo.datahub.service;

import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import io.koravo.datahub.domain.DataSourceStatus;
import io.koravo.datahub.domain.KoDataSource;
import io.koravo.datahub.repo.DataSourceRepository;
import io.koravo.datahub.web.DataSourceCreateRequest;
import io.koravo.datahub.web.DataSourceResponse;
import io.koravo.datahub.web.DataSourceTestResponse;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.sql.Connection;
import java.sql.DriverManager;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

@Service
public class DataSourceService {
    private static final int TEST_TIMEOUT_SECONDS = 5;

    private final DataSourceRepository repository;
    private final SecretService secretService;
    private final AuditLogService auditLogService;
    private final DataSourceTestLogService testLogService;

    public DataSourceService(
            DataSourceRepository repository,
            SecretService secretService,
            AuditLogService auditLogService,
            DataSourceTestLogService testLogService
    ) {
        this.repository = repository;
        this.secretService = secretService;
        this.auditLogService = auditLogService;
        this.testLogService = testLogService;
    }

    @Transactional
    public DataSourceResponse create(DataSourceCreateRequest request) {
        KoDataSource dataSource = new KoDataSource();
        dataSource.setTenantId(TenantContextHolder.getTenantId());
        dataSource.setCreatedBy(UserContextHolder.getUserId());
        dataSource.setUpdatedBy(UserContextHolder.getUserId());
        dataSource.setName(request.name());
        dataSource.setType(request.type());
        dataSource.setJdbcUrl(request.jdbcUrl());
        dataSource.setUsername(request.username());
        dataSource.setPasswordCipher(secretService.encrypt(request.password()));
        dataSource.setDriverClassName(StringUtils.hasText(request.driverClassName())
                ? request.driverClassName()
                : request.type().defaultDriverClassName());
        dataSource.setReadOnly(request.readOnly());
        dataSource.setPoolConfigJson(request.poolConfigJson());
        dataSource.setStatus(DataSourceStatus.ACTIVE);
        KoDataSource saved = repository.save(dataSource);
        auditLogService.record("DATASOURCE_CREATE", "DATASOURCE", saved.getId(), Map.of("name", saved.getName()));
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<DataSourceResponse> list() {
        return repository.findByTenantIdAndDeletedFalseOrderByCreatedAtDesc(TenantContextHolder.getTenantId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public DataSourceResponse get(String id) {
        return toResponse(find(id));
    }

    @Transactional
    public DataSourceResponse update(String id, DataSourceCreateRequest request) {
        KoDataSource dataSource = find(id);
        dataSource.setUpdatedBy(UserContextHolder.getUserId());
        dataSource.setName(request.name());
        dataSource.setType(request.type());
        dataSource.setJdbcUrl(request.jdbcUrl());
        dataSource.setUsername(request.username());
        if (StringUtils.hasText(request.password())) {
            dataSource.setPasswordCipher(secretService.encrypt(request.password()));
        }
        dataSource.setDriverClassName(StringUtils.hasText(request.driverClassName())
                ? request.driverClassName()
                : request.type().defaultDriverClassName());
        dataSource.setReadOnly(request.readOnly());
        dataSource.setPoolConfigJson(request.poolConfigJson());
        KoDataSource saved = repository.save(dataSource);
        auditLogService.record("DATASOURCE_UPDATE", "DATASOURCE", saved.getId(), Map.of("name", saved.getName()));
        return toResponse(saved);
    }

    @Transactional
    public void delete(String id) {
        KoDataSource dataSource = find(id);
        dataSource.setUpdatedBy(UserContextHolder.getUserId());
        dataSource.setDeleted(true);
        auditLogService.record("DATASOURCE_DELETE", "DATASOURCE", dataSource.getId(), Map.of("name", dataSource.getName()));
    }

    @Transactional
    public DataSourceTestResponse test(String id) {
        KoDataSource dataSource = find(id);
        Instant started = Instant.now();
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            Callable<Void> callable = () -> {
                Class.forName(dataSource.getDriverClassName());
                DriverManager.setLoginTimeout(TEST_TIMEOUT_SECONDS);
                try (Connection connection = DriverManager.getConnection(
                        dataSource.getJdbcUrl(),
                        dataSource.getUsername(),
                        secretService.decrypt(dataSource.getPasswordCipher())
                )) {
                    connection.setReadOnly(dataSource.isReadOnly());
                    return null;
                }
            };
            executor.submit(callable).get(TEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            DataSourceTestResponse response = new DataSourceTestResponse(true, "连接成功", elapsed(started));
            testLogService.record(dataSource, true, response.message(), response.elapsedMillis());
            auditLogService.record("DATASOURCE_TEST", "DATASOURCE", dataSource.getId(), testAuditDetail(dataSource, true, response.elapsedMillis()));
            return response;
        } catch (Exception e) {
            DataSourceTestResponse response = new DataSourceTestResponse(false, readableTestError(e), elapsed(started));
            testLogService.record(dataSource, false, response.message(), response.elapsedMillis());
            auditLogService.record("DATASOURCE_TEST", "DATASOURCE", dataSource.getId(), testAuditDetail(dataSource, false, response.elapsedMillis()));
            return response;
        } finally {
            executor.shutdownNow();
        }
    }

    private KoDataSource find(String id) {
        return repository.findByIdAndTenantIdAndDeletedFalse(id, TenantContextHolder.getTenantId())
                .orElseThrow(() -> new BusinessException(ErrorCode.DATASOURCE_NOT_FOUND, "数据源不存在"));
    }

    private DataSourceResponse toResponse(KoDataSource dataSource) {
        return new DataSourceResponse(
                dataSource.getId(),
                dataSource.getName(),
                dataSource.getType().name(),
                dataSource.getJdbcUrl(),
                dataSource.getUsername(),
                dataSource.getDriverClassName(),
                dataSource.isReadOnly(),
                dataSource.getPoolConfigJson(),
                dataSource.getStatus().name()
        );
    }

    private long elapsed(Instant started) {
        return Duration.between(started, Instant.now()).toMillis();
    }

    private String readableTestError(Exception e) {
        String message = e.getMessage();
        if (!StringUtils.hasText(message)) {
            return "连接失败";
        }
        return "连接失败：" + message;
    }

    private Map<String, Object> testAuditDetail(KoDataSource dataSource, boolean connected, long elapsedMillis) {
        return Map.of(
                "name", dataSource.getName(),
                "type", dataSource.getType().name(),
                "connected", connected,
                "elapsedMillis", elapsedMillis
        );
    }
}
