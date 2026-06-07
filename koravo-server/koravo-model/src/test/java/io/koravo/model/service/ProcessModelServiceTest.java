package io.koravo.model.service;

import io.koravo.engine.api.ProcessFacade;
import io.koravo.model.domain.KoProcessModel;
import io.koravo.model.domain.ProcessModelStatus;
import io.koravo.model.repo.ProcessModelRepository;
import io.koravo.model.validation.BpmnValidationService;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProcessModelServiceTest {
    private final ProcessFacade processFacade = mock(ProcessFacade.class);
    private final ProcessModelRepository repository = mock(ProcessModelRepository.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final BpmnValidationService validationService = mock(BpmnValidationService.class);
    private final ProcessModelService service = new ProcessModelService(processFacade, repository, auditLogService, validationService);

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
        UserContextHolder.clear();
    }

    @Test
    void disableUpdatesStatusAndWritesAuditLog() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoProcessModel model = model("model-1", ProcessModelStatus.DEPLOYED);
        when(repository.findByIdAndTenantIdAndDeletedFalse("model-1", "default")).thenReturn(Optional.of(model));

        var response = service.disable("model-1");

        assertThat(response.status()).isEqualTo("DISABLED");
        assertThat(model.getUpdatedBy()).isEqualTo("admin");
        verify(repository).save(model);
        verify(auditLogService).record("PROCESS_MODEL_DISABLE", "PROCESS_MODEL", "model-1", Map.of("modelKey", "leaveApproval"));
    }

    @Test
    void archiveUpdatesStatusAndWritesAuditLog() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoProcessModel model = model("model-1", ProcessModelStatus.DISABLED);
        when(repository.findByIdAndTenantIdAndDeletedFalse("model-1", "default")).thenReturn(Optional.of(model));

        var response = service.archive("model-1");

        assertThat(response.status()).isEqualTo("ARCHIVED");
        assertThat(model.getUpdatedBy()).isEqualTo("admin");
        verify(repository).save(model);
        verify(auditLogService).record("PROCESS_MODEL_ARCHIVE", "PROCESS_MODEL", "model-1", Map.of("modelKey", "leaveApproval"));
    }

    private KoProcessModel model(String id, ProcessModelStatus status) {
        KoProcessModel model = new KoProcessModel();
        model.setId(id);
        model.setTenantId("default");
        model.setModelKey("leaveApproval");
        model.setModelName("Leave Approval");
        model.setModelType("BPMN");
        model.setVersion(1);
        model.setStatus(status);
        model.setBpmnXml("<definitions />");
        return model;
    }
}
