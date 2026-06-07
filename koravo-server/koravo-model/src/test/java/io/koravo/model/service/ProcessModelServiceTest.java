package io.koravo.model.service;

import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.DeployProcessCommand;
import io.koravo.engine.dto.ProcessDeploymentDTO;
import io.koravo.model.domain.KoProcessModel;
import io.koravo.model.domain.ProcessModelStatus;
import io.koravo.model.dto.ProcessModelImportRequest;
import io.koravo.model.repo.ProcessModelRepository;
import io.koravo.model.validation.BpmnValidationResult;
import io.koravo.model.validation.BpmnValidationService;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
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

    @Test
    void directDeployPersistsModelAndWritesModelDeployAudit() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        String bpmnXml = "<definitions><process id=\"leaveApproval\" /></definitions>";
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "leave-approval.bpmn20.xml",
                "text/xml",
                bpmnXml.getBytes()
        );
        ProcessDeploymentDTO deployment = new ProcessDeploymentDTO(
                null,
                "dep-1",
                "pd-1",
                "leaveApproval",
                3
        );
        when(validationService.validate(bpmnXml)).thenReturn(new BpmnValidationResult(true, List.of(), List.of()));
        when(processFacade.deploy(new DeployProcessCommand(
                "default",
                "admin",
                "leave_approval",
                "Leave Approval",
                "leave-approval.bpmn20.xml",
                bpmnXml
        ))).thenReturn(deployment);
        when(repository.save(any(KoProcessModel.class))).thenAnswer(invocation -> {
            KoProcessModel saved = invocation.getArgument(0);
            saved.setId("model-1");
            return saved;
        });

        var response = service.deploy("Leave Approval", file);

        assertThat(response.platformModelId()).isEqualTo("model-1");
        assertThat(response.processDefinitionKey()).isEqualTo("leaveApproval");
        verify(auditLogService).record("PROCESS_MODEL_DEPLOY", "PROCESS_MODEL", "model-1", Map.of(
                "deploymentId", "dep-1",
                "processDefinitionId", "pd-1",
                "processDefinitionKey", "leaveApproval"
        ));
    }

    @Test
    void importPersistsDraftAndWritesImportAudit() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        String bpmnXml = "<definitions><process id=\"expenseApproval\" /></definitions>";
        when(validationService.validate(bpmnXml)).thenReturn(new BpmnValidationResult(true, List.of(), List.of()));
        when(repository.save(any(KoProcessModel.class))).thenAnswer(invocation -> {
            KoProcessModel saved = invocation.getArgument(0);
            saved.setId("model-import-1");
            return saved;
        });

        var response = service.importModel(new ProcessModelImportRequest(
                "Expense Approval",
                "Imported demo model",
                bpmnXml
        ));

        assertThat(response.id()).isEqualTo("model-import-1");
        assertThat(response.modelKey()).isEqualTo("expenseApproval");
        assertThat(response.status()).isEqualTo("DRAFT");
        verify(auditLogService).record("PROCESS_MODEL_IMPORT", "PROCESS_MODEL", "model-import-1", Map.of(
                "modelKey", "expenseApproval"
        ));
        verify(auditLogService, never()).record("PROCESS_MODEL_CREATE", "PROCESS_MODEL", "model-import-1", Map.of(
                "modelKey", "expenseApproval"
        ));
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
