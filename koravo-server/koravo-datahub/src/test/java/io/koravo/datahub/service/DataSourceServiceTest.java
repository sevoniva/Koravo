package io.koravo.datahub.service;

import io.koravo.datahub.domain.DataSourceType;
import io.koravo.datahub.domain.DataSourceStatus;
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
import static org.mockito.Mockito.verify;
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

    @Test
    void getDoesNotReturnPlaintextOrCipherPassword() {
        TenantContextHolder.setTenantId("default");
        KoDataSource dataSource = new KoDataSource();
        dataSource.setId("ds-1");
        dataSource.setTenantId("default");
        dataSource.setName("pg");
        dataSource.setType(DataSourceType.POSTGRESQL);
        dataSource.setJdbcUrl("jdbc:postgresql://localhost:5432/koravo");
        dataSource.setUsername("koravo");
        dataSource.setPasswordCipher(secretService.encrypt("secret-password"));
        dataSource.setDriverClassName(DataSourceType.POSTGRESQL.defaultDriverClassName());
        dataSource.setReadOnly(true);
        dataSource.setPoolConfigJson("{}");
        dataSource.setStatus(DataSourceStatus.ACTIVE);
        when(repository.findByIdAndTenantIdAndDeletedFalse("ds-1", "default")).thenReturn(Optional.of(dataSource));

        var response = service.get("ds-1");

        assertThat(response.toString()).doesNotContain("secret-password");
        assertThat(response.toString()).doesNotContain(dataSource.getPasswordCipher());
    }

    @Test
    void updatePreservesPasswordWhenBlankAndWritesAudit() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoDataSource dataSource = existingPostgresDataSource();
        String originalCipher = dataSource.getPasswordCipher();
        when(repository.findByIdAndTenantIdAndDeletedFalse("ds-1", "default")).thenReturn(Optional.of(dataSource));
        when(repository.save(any(KoDataSource.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.update("ds-1", new DataSourceCreateRequest(
                "pg updated",
                DataSourceType.POSTGRESQL,
                "jdbc:postgresql://localhost:5432/koravo_updated",
                "koravo_user",
                "",
                null,
                false,
                "{\"maximumPoolSize\":3}"
        ));

        assertThat(response.name()).isEqualTo("pg updated");
        assertThat(response.username()).isEqualTo("koravo_user");
        assertThat(response.readOnly()).isFalse();
        assertThat(dataSource.getPasswordCipher()).isEqualTo(originalCipher);
        assertThat(response.toString()).doesNotContain(originalCipher);
        verify(auditLogService).record("DATASOURCE_UPDATE", "DATASOURCE", "ds-1", java.util.Map.of("name", "pg updated"));
    }

    @Test
    void updateEncryptsNewPassword() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoDataSource dataSource = existingPostgresDataSource();
        String originalCipher = dataSource.getPasswordCipher();
        when(repository.findByIdAndTenantIdAndDeletedFalse("ds-1", "default")).thenReturn(Optional.of(dataSource));
        when(repository.save(any(KoDataSource.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.update("ds-1", new DataSourceCreateRequest(
                "pg",
                DataSourceType.POSTGRESQL,
                "jdbc:postgresql://localhost:5432/koravo",
                "koravo",
                "new-secret",
                null,
                true,
                "{}"
        ));

        assertThat(dataSource.getPasswordCipher()).isNotEqualTo(originalCipher);
        assertThat(secretService.decrypt(dataSource.getPasswordCipher())).isEqualTo("new-secret");
    }

    @Test
    void deleteSoftDeletesDatasourceAndWritesAudit() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoDataSource dataSource = existingPostgresDataSource();
        when(repository.findByIdAndTenantIdAndDeletedFalse("ds-1", "default")).thenReturn(Optional.of(dataSource));

        service.delete("ds-1");

        assertThat(dataSource.isDeleted()).isTrue();
        assertThat(dataSource.getUpdatedBy()).isEqualTo("admin");
        verify(auditLogService).record("DATASOURCE_DELETE", "DATASOURCE", "ds-1", java.util.Map.of("name", "pg"));
    }

    private KoDataSource existingPostgresDataSource() {
        KoDataSource dataSource = new KoDataSource();
        dataSource.setId("ds-1");
        dataSource.setTenantId("default");
        dataSource.setName("pg");
        dataSource.setType(DataSourceType.POSTGRESQL);
        dataSource.setJdbcUrl("jdbc:postgresql://localhost:5432/koravo");
        dataSource.setUsername("koravo");
        dataSource.setPasswordCipher(secretService.encrypt("secret-password"));
        dataSource.setDriverClassName(DataSourceType.POSTGRESQL.defaultDriverClassName());
        dataSource.setReadOnly(true);
        dataSource.setPoolConfigJson("{}");
        dataSource.setStatus(DataSourceStatus.ACTIVE);
        return dataSource;
    }
}
