package io.koravo.form.service;

import io.koravo.form.domain.KoFormBinding;
import io.koravo.form.repo.FormBindingRepository;
import io.koravo.form.web.FormBindingRequest;
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
        )).thenAnswer(invocation -> {
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
    }
}
