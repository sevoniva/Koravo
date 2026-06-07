package io.koravo.datahub.service;

import io.koravo.datahub.domain.DataSourceType;
import io.koravo.datahub.domain.KoDataSource;
import io.koravo.datahub.repo.DataSourceRepository;
import io.koravo.datahub.web.DataSourceCreateRequest;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DataSourceServiceTest {
    private final DataSourceRepository repository = mock(DataSourceRepository.class);
    private final SecretService secretService = new AesSecretService("test-secret");
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final DataSourceTestLogService testLogService = mock(DataSourceTestLogService.class);
    private final DataSourceService service = new DataSourceService(repository, secretService, auditLogService, testLogService);

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
        UserContextHolder.clear();
    }

    @Test
    void createDoesNotReturnPassword() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        when(repository.save(any(KoDataSource.class))).thenAnswer(invocation -> {
            KoDataSource dataSource = invocation.getArgument(0);
            dataSource.prePersist();
            return dataSource;
        });

        var response = service.create(new DataSourceCreateRequest(
                "h2",
                DataSourceType.H2,
                "jdbc:h2:mem:koravo_create;DB_CLOSE_DELAY=-1",
                "sa",
                "secret",
                null,
                true,
                "{}"
        ));

        assertThat(response.id()).isNotBlank();
        assertThat(response.username()).isEqualTo("sa");
        assertThat(response.toString()).doesNotContain("secret");
    }

    @Test
    void testSupportsH2Connection() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoDataSource dataSource = new KoDataSource();
        dataSource.setId("ds-h2");
        dataSource.setTenantId("default");
        dataSource.setName("h2");
        dataSource.setType(DataSourceType.H2);
        dataSource.setJdbcUrl("jdbc:h2:mem:koravo_test;DB_CLOSE_DELAY=-1");
        dataSource.setUsername("sa");
        dataSource.setPasswordCipher(secretService.encrypt(""));
        dataSource.setDriverClassName(DataSourceType.H2.defaultDriverClassName());
        dataSource.setReadOnly(true);
        when(repository.findByIdAndTenantIdAndDeletedFalse("ds-h2", "default")).thenReturn(Optional.of(dataSource));

        var response = service.test("ds-h2");

        assertThat(response.connected()).isTrue();
        assertThat(response.message()).isEqualTo("Connection successful");
    }
}
