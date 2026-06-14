package io.koravo.datahub.service;

import io.koravo.datahub.domain.KoDataSourceTestLog;
import io.koravo.datahub.repo.DataSourceTestLogRepository;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DataSourceTestLogServiceTest {
    private final DataSourceTestLogRepository repository = mock(DataSourceTestLogRepository.class);
    private final DataSourceTestLogService service = new DataSourceTestLogService(repository);

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    void listReturnsPagedLogsWithRedactedMessage() {
        TenantContextHolder.setTenantId("default");
        KoDataSourceTestLog log = new KoDataSourceTestLog();
        log.setId("log-1");
        log.setTenantId("default");
        log.setDatasourceId("ds-1");
        log.setSuccess(false);
        log.setMessage("password=secret failed");
        log.setElapsedMillis(31);
        log.setCreatedAt(Instant.parse("2026-06-07T00:00:00Z"));
        when(repository.findByTenantIdAndDatasourceIdOrderByCreatedAtDesc(eq("default"), eq("ds-1"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(log)));

        var result = service.list("ds-1", 1, 20);

        assertThat(result.total()).isEqualTo(1);
        assertThat(result.items()).hasSize(1);
        assertThat(result.items().getFirst().message()).doesNotContain("secret");
    }
}
