package io.koravo.form.service;

import io.koravo.common.exception.BusinessException;
import io.koravo.form.domain.KoFormBinding;
import io.koravo.form.repo.FormBindingRepository;
import io.koravo.form.web.FormBindingRequest;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FormBindingServiceTest {
    private final FormBindingRepository repository = mock(FormBindingRepository.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final FormBindingService service = new FormBindingService(repository, auditLogService);

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
        UserContextHolder.clear();
    }

    @Test
    void bindAndFindByProcessModelTaskKey() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        when(repository.save(any(KoFormBinding.class))).thenAnswer(invocation -> {
            KoFormBinding binding = invocation.getArgument(0);
            binding.setId("binding-1");
            binding.prePersist();
            return binding;
        });
        when(repository.findFirstByTenantIdAndProcessModelIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "model-1",
                "approveTask"
        )).thenReturn(Optional.empty()).thenAnswer(invocation -> {
            KoFormBinding binding = new KoFormBinding();
            binding.setId("binding-1");
            binding.setTenantId("default");
            binding.setProcessModelId("model-1");
            binding.setTaskDefinitionKey("approveTask");
            binding.setFormSchemaId("form-1");
            binding.setFormSchemaVersion(2);
            binding.prePersist();
            return Optional.of(binding);
        });

        var created = service.bind(new FormBindingRequest("model-1", null, "approveTask", "form-1", 2));
        var found = service.findByProcessModelTaskKey("model-1", "approveTask").orElseThrow();

        assertThat(created.id()).isEqualTo("binding-1");
        assertThat(found.formSchemaId()).isEqualTo("form-1");
        assertThat(found.formSchemaVersion()).isEqualTo(2);
        verify(auditLogService).record("FORM_BIND", "FORM_BINDING", "binding-1", java.util.Map.of(
                "processModelId", "model-1",
                "taskDefinitionKey", "approveTask",
                "formSchemaId", "form-1"
        ));
    }

    @Test
    void bindRejectsDuplicateProcessNodeBinding() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoFormBinding existing = new KoFormBinding();
        existing.setId("binding-1");
        existing.setTenantId("default");
        existing.setProcessModelId("model-1");
        existing.setTaskDefinitionKey("approveTask");
        existing.setFormSchemaId("form-1");
        existing.setFormSchemaVersion(1);
        existing.prePersist();
        when(repository.findFirstByTenantIdAndProcessModelIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "model-1",
                "approveTask"
        )).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.bind(new FormBindingRequest("model-1", null, "approveTask", "form-2", 1)))
                .isInstanceOf(BusinessException.class)
                .hasMessage("该流程节点已绑定表单");
        verify(repository, never()).save(any(KoFormBinding.class));
    }

    @Test
    void updateChangesBindingAndWritesAudit() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoFormBinding existing = new KoFormBinding();
        existing.setId("binding-1");
        existing.setTenantId("default");
        existing.setProcessModelId("model-1");
        existing.setTaskDefinitionKey("approveTask");
        existing.setFormSchemaId("form-1");
        existing.setFormSchemaVersion(1);
        existing.prePersist();
        when(repository.findById("binding-1")).thenReturn(Optional.of(existing));
        when(repository.save(any(KoFormBinding.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var updated = service.update("binding-1", new FormBindingRequest("model-1", "pd-1", "reviewTask", "form-2", 3));

        assertThat(updated.processDefinitionId()).isEqualTo("pd-1");
        assertThat(updated.taskDefinitionKey()).isEqualTo("reviewTask");
        assertThat(updated.formSchemaId()).isEqualTo("form-2");
        assertThat(updated.formSchemaVersion()).isEqualTo(3);
        verify(auditLogService).record("FORM_BIND_UPDATE", "FORM_BINDING", "binding-1", java.util.Map.of(
                "processModelId", "model-1",
                "processDefinitionId", "pd-1",
                "taskDefinitionKey", "reviewTask",
                "formSchemaId", "form-2"
        ));
    }

    @Test
    void listCanFilterByProcessDefinitionId() {
        TenantContextHolder.setTenantId("default");
        KoFormBinding binding = new KoFormBinding();
        binding.setId("binding-1");
        binding.setTenantId("default");
        binding.setProcessDefinitionId("pd-1");
        binding.setTaskDefinitionKey("approveTask");
        binding.setFormSchemaId("form-1");
        binding.setFormSchemaVersion(1);
        binding.prePersist();
        when(repository.findByTenantIdAndProcessDefinitionIdAndDeletedFalseOrderByUpdatedAtDesc("default", "pd-1"))
                .thenReturn(List.of(binding));

        var result = service.list(null, "pd-1");

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().processDefinitionId()).isEqualTo("pd-1");
        verify(repository).findByTenantIdAndProcessDefinitionIdAndDeletedFalseOrderByUpdatedAtDesc("default", "pd-1");
    }

    @Test
    void deleteSoftDeletesBindingAndWritesAudit() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoFormBinding existing = new KoFormBinding();
        existing.setId("binding-1");
        existing.setTenantId("default");
        existing.setProcessModelId("model-1");
        existing.setTaskDefinitionKey("approveTask");
        existing.setFormSchemaId("form-1");
        existing.setFormSchemaVersion(1);
        existing.prePersist();
        when(repository.findById("binding-1")).thenReturn(Optional.of(existing));

        service.delete("binding-1");

        assertThat(existing.isDeleted()).isTrue();
        assertThat(existing.getUpdatedBy()).isEqualTo("admin");
        verify(auditLogService).record("FORM_BIND_DELETE", "FORM_BINDING", "binding-1", java.util.Map.of(
                "processModelId", "model-1",
                "taskDefinitionKey", "approveTask",
                "formSchemaId", "form-1"
        ));
    }
}
