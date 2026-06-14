package io.koravo.form.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.koravo.common.model.AssetOrigin;
import io.koravo.form.domain.FormStatus;
import io.koravo.form.domain.KoFormSchema;
import io.koravo.form.domain.KoFormSchemaVersion;
import io.koravo.form.repo.FormSchemaRepository;
import io.koravo.form.repo.FormSchemaVersionRepository;
import io.koravo.form.web.FormSchemaRequest;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.tenant.TenantContextHolder;
import io.koravo.security.UserContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FormSchemaServiceTest {
    private final FormSchemaRepository repository = mock(FormSchemaRepository.class);
    private final FormSchemaVersionRepository versionRepository = mock(FormSchemaVersionRepository.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final FormSchemaService service = new FormSchemaService(repository, versionRepository, auditLogService, new ObjectMapper());

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
        UserContextHolder.clear();
    }

    @Test
    void createWritesAuditLog() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        when(repository.save(any(KoFormSchema.class))).thenAnswer(invocation -> {
            KoFormSchema schema = invocation.getArgument(0);
            schema.setId("form-1");
            return schema;
        });

        var result = service.create(new FormSchemaRequest(
                "leave",
                "Leave",
                "{\"type\":\"object\",\"properties\":{\"days\":{\"type\":\"number\"}}}",
                "{}"
        ));

        assertThat(result.id()).isEqualTo("form-1");
        assertThat(result.assetOrigin()).isEqualTo("USER_FLOW");
        verify(versionRepository).save(any(KoFormSchemaVersion.class));
        verify(auditLogService).record("FORM_SCHEMA_CREATE", "FORM_SCHEMA", "form-1", Map.of("formKey", "leave"));
    }

    @Test
    void listReturnsTenantSchemas() {
        TenantContextHolder.setTenantId("default");
        KoFormSchema schema = schema("form-1", 1);
        when(repository.findByTenantIdAndAssetOriginInAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                List.of(AssetOrigin.SYSTEM_TEMPLATE, AssetOrigin.USER_FLOW)
        )).thenReturn(List.of(schema));

        var result = service.list();

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().id()).isEqualTo("form-1");
    }

    @Test
    void listCanIncludeNonProductionSchemasForGovernanceCleanup() {
        TenantContextHolder.setTenantId("default");
        KoFormSchema schema = schema("legacy-form", 1);
        schema.setAssetOrigin(AssetOrigin.LEGACY_DEMO);
        when(repository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc("default")).thenReturn(List.of(schema));

        var result = service.list(true);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().assetOrigin()).isEqualTo("LEGACY_DEMO");
    }

    @Test
    void updateIncrementsVersionAndKeepsCurrentStatus() {
        TenantContextHolder.setTenantId("default");
        KoFormSchema schema = schema("form-1", 1);
        schema.setStatus(FormStatus.DISABLED);
        when(repository.findByIdAndTenantIdAndDeletedFalse("form-1", "default")).thenReturn(Optional.of(schema));
        when(repository.save(any(KoFormSchema.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.update("form-1", new FormSchemaRequest(
                "leave",
                "Leave Approval",
                "{\"type\":\"object\",\"required\":[\"days\"],\"properties\":{\"days\":{\"type\":\"number\"}}}",
                "{}"
        ));

        assertThat(result.version()).isEqualTo(2);
        assertThat(result.formName()).isEqualTo("Leave Approval");
        assertThat(result.status()).isEqualTo("DISABLED");
        verify(versionRepository).save(any(KoFormSchemaVersion.class));
        verify(auditLogService).record("FORM_SCHEMA_UPDATE", "FORM_SCHEMA", "form-1", Map.of(
                "formKey", "leave",
                "version", 2
        ));
    }

    @Test
    void listVersionsReturnsSchemaHistory() {
        TenantContextHolder.setTenantId("default");
        KoFormSchema schema = schema("form-1", 2);
        KoFormSchemaVersion version = version("form-1", 1);
        when(repository.findByIdAndTenantIdAndDeletedFalse("form-1", "default")).thenReturn(Optional.of(schema));
        when(versionRepository.findByTenantIdAndFormSchemaIdAndDeletedFalseOrderByVersionDesc("default", "form-1"))
                .thenReturn(List.of(version));

        var result = service.listVersions("form-1");

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().version()).isEqualTo(1);
        assertThat(result.getFirst().schemaJson()).contains("days");
    }

    @Test
    void getSpecificVersionReturnsHistoricalSchema() {
        TenantContextHolder.setTenantId("default");
        KoFormSchema schema = schema("form-1", 3);
        KoFormSchemaVersion oldVersion = version("form-1", 1);
        oldVersion.setFormName("Old Leave");
        oldVersion.setSchemaJson("{\"type\":\"object\",\"properties\":{\"reason\":{\"type\":\"string\"}}}");
        when(repository.findByIdAndTenantIdAndDeletedFalse("form-1", "default")).thenReturn(Optional.of(schema));
        when(versionRepository.findByTenantIdAndFormSchemaIdAndVersionAndDeletedFalse("default", "form-1", 1))
                .thenReturn(Optional.of(oldVersion));

        var result = service.get("form-1", 1);

        assertThat(result.id()).isEqualTo("form-1");
        assertThat(result.version()).isEqualTo(1);
        assertThat(result.formName()).isEqualTo("Old Leave");
        assertThat(result.schemaJson()).contains("reason");
        assertThat(result.status()).isEqualTo("ACTIVE");
    }

    @Test
    void restoreVersionCreatesNewCurrentVersion() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoFormSchema schema = schema("form-1", 3);
        KoFormSchemaVersion oldVersion = version("form-1", 1);
        oldVersion.setFormName("Old Leave");
        oldVersion.setSchemaJson("{\"type\":\"object\",\"properties\":{\"reason\":{\"type\":\"string\"}}}");
        when(repository.findByIdAndTenantIdAndDeletedFalse("form-1", "default")).thenReturn(Optional.of(schema));
        when(versionRepository.findByTenantIdAndFormSchemaIdAndVersionAndDeletedFalse("default", "form-1", 1))
                .thenReturn(Optional.of(oldVersion));
        when(repository.save(any(KoFormSchema.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.restoreVersion("form-1", 1);

        assertThat(result.version()).isEqualTo(4);
        assertThat(result.formName()).isEqualTo("Old Leave");
        assertThat(result.schemaJson()).contains("reason");
        verify(versionRepository).save(any(KoFormSchemaVersion.class));
        verify(auditLogService).record("FORM_SCHEMA_RESTORE_VERSION", "FORM_SCHEMA", "form-1", Map.of(
                "formKey", "leave",
                "fromVersion", 1,
                "version", 4
        ));
    }

    @Test
    void disableAndActivateUpdateStatusWithAuditLog() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoFormSchema schema = schema("form-1", 1);
        when(repository.findByIdAndTenantIdAndDeletedFalse("form-1", "default")).thenReturn(Optional.of(schema));
        when(repository.save(any(KoFormSchema.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var disabled = service.disable("form-1");
        var active = service.activate("form-1");

        assertThat(disabled.status()).isEqualTo("DISABLED");
        assertThat(active.status()).isEqualTo("ACTIVE");
        verify(auditLogService).record("FORM_SCHEMA_DISABLE", "FORM_SCHEMA", "form-1", Map.of(
                "formKey", "leave",
                "status", "DISABLED"
        ));
        verify(auditLogService).record("FORM_SCHEMA_ACTIVATE", "FORM_SCHEMA", "form-1", Map.of(
                "formKey", "leave",
                "status", "ACTIVE"
        ));
    }

    @Test
    void activateRejectsReleaseBlockingIssues() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoFormSchema schema = schema("form-1", 1);
        schema.setStatus(FormStatus.DISABLED);
        schema.setSchemaJson("""
                {"type":"object","required":["subject"],"properties":{"subject":{"title":"事项名称","type":"string"}}}
                """);
        schema.setUiSchemaJson("{\"subject\":{\"permission\":\"hidden\"}}");
        when(repository.findByIdAndTenantIdAndDeletedFalse("form-1", "default")).thenReturn(Optional.of(schema));

        assertThatThrownBy(() -> service.activate("form-1"))
                .hasMessage("发布检查未通过：隐藏必填字段：事项名称");
    }

    @Test
    void updateRejectsBlockingIssuesWhenSchemaIsActive() {
        TenantContextHolder.setTenantId("default");
        KoFormSchema schema = schema("form-1", 1);
        when(repository.findByIdAndTenantIdAndDeletedFalse("form-1", "default")).thenReturn(Optional.of(schema));

        assertThatThrownBy(() -> service.update("form-1", new FormSchemaRequest(
                "leave",
                "Leave",
                """
                        {"type":"object","properties":{"subject":{"title":"事项名称","type":"string","minLength":20,"maxLength":5}}}
                        """,
                "{}"
        ))).hasMessage("发布检查未通过：事项名称的最少字符不能大于最多字符");
    }

    @Test
    void createRejectsInvalidSchemaPayload() {
        TenantContextHolder.setTenantId("default");

        assertThatThrownBy(() -> service.create(new FormSchemaRequest(
                "leave",
                "Leave",
                "{\"type\":\"object\"}",
                "{}"
        ))).hasMessage("表单结构配置必须包含字段清单");

        assertThatThrownBy(() -> service.create(new FormSchemaRequest(
                "leave",
                "Leave",
                "{\"type\":\"object\",\"properties\":{}}",
                "{}"
        ))).hasMessage("发布检查未通过：请先配置字段");

        assertThatThrownBy(() -> service.create(new FormSchemaRequest(
                "leave",
                "Leave",
                "{\"type\":\"object\",\"properties\":{}}",
                "{"
        ))).hasMessage("表单展示配置不是有效 JSON");
    }

    private KoFormSchema schema(String id, int version) {
        KoFormSchema schema = new KoFormSchema();
        schema.setId(id);
        schema.setTenantId("default");
        schema.setFormKey("leave");
        schema.setFormName("Leave");
        schema.setVersion(version);
        schema.setSchemaJson("{\"type\":\"object\",\"properties\":{\"days\":{\"type\":\"number\"}}}");
        schema.setUiSchemaJson("{}");
        schema.setStatus(FormStatus.ACTIVE);
        return schema;
    }

    private KoFormSchemaVersion version(String formSchemaId, int version) {
        KoFormSchemaVersion item = new KoFormSchemaVersion();
        item.setId("version-" + version);
        item.setTenantId("default");
        item.setFormSchemaId(formSchemaId);
        item.setVersion(version);
        item.setFormKey("leave");
        item.setFormName("Leave");
        item.setSchemaJson("{\"type\":\"object\",\"properties\":{\"days\":{\"type\":\"number\"}}}");
        item.setUiSchemaJson("{}");
        return item;
    }
}
