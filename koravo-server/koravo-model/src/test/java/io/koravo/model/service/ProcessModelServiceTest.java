package io.koravo.model.service;

import io.koravo.common.model.AssetOrigin;
import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.DeployProcessCommand;
import io.koravo.engine.dto.ProcessDeploymentDTO;
import io.koravo.model.domain.KoProcessModel;
import io.koravo.model.domain.ProcessModelStatus;
import io.koravo.model.dto.ProcessModelUpdateRequest;
import io.koravo.model.dto.ProcessModelImportRequest;
import io.koravo.model.repo.ProcessModelRepository;
import io.koravo.model.validation.BpmnValidationResult;
import io.koravo.model.validation.BpmnValidationService;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
        verify(auditLogService).record("PROCESS_MODEL_DISABLE", "PROCESS_MODEL", "model-1", Map.of(
                "modelKey", "leaveApproval",
                "version", 1,
                "status", "DISABLED",
                "assetOrigin", "USER_FLOW"
        ));
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
        verify(auditLogService).record("PROCESS_MODEL_ARCHIVE", "PROCESS_MODEL", "model-1", Map.of(
                "modelKey", "leaveApproval",
                "version", 1,
                "status", "ARCHIVED",
                "assetOrigin", "USER_FLOW"
        ));
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
        ArgumentCaptor<KoProcessModel> modelCaptor = ArgumentCaptor.forClass(KoProcessModel.class);
        verify(repository).save(modelCaptor.capture());
        assertThat(modelCaptor.getValue().getAssetOrigin().name()).isEqualTo("USER_FLOW");
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
        assertThat(response.assetOrigin()).isEqualTo("USER_FLOW");
        verify(auditLogService).record("PROCESS_MODEL_IMPORT", "PROCESS_MODEL", "model-import-1", Map.of(
                "modelKey", "expenseApproval",
                "version", 1,
                "status", "DRAFT",
                "assetOrigin", "USER_FLOW"
        ));
        verify(auditLogService, never()).record("PROCESS_MODEL_CREATE", "PROCESS_MODEL", "model-import-1", Map.of(
                "modelKey", "expenseApproval"
        ));
    }

    @Test
    void importReadsProcessIdFromNamespacedBpmn() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        String bpmnXml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
                  <bpmn:process id="contractFlow" isExecutable="true" />
                </bpmn:definitions>
                """;
        when(validationService.validate(bpmnXml)).thenReturn(new BpmnValidationResult(true, List.of(), List.of()));
        when(repository.save(any(KoProcessModel.class))).thenAnswer(invocation -> {
            KoProcessModel saved = invocation.getArgument(0);
            saved.setId("model-import-2");
            return saved;
        });

        var response = service.importModel(new ProcessModelImportRequest(
                "Contract Flow",
                null,
                bpmnXml
        ));

        assertThat(response.modelKey()).isEqualTo("contractFlow");
        verify(auditLogService).record("PROCESS_MODEL_IMPORT", "PROCESS_MODEL", "model-import-2", Map.of(
                "modelKey", "contractFlow",
                "version", 1,
                "status", "DRAFT",
                "assetOrigin", "USER_FLOW"
        ));
    }

    @Test
    void listHidesNonProductionAssetsByDefault() {
        TenantContextHolder.setTenantId("default");
        KoProcessModel model = model("model-1", ProcessModelStatus.DEPLOYED);
        when(repository.findByTenantIdAndAssetOriginInAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                List.of(AssetOrigin.SYSTEM_TEMPLATE, AssetOrigin.USER_FLOW)
        )).thenReturn(List.of(model));

        var result = service.list(null);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().id()).isEqualTo("model-1");
        verify(repository).findByTenantIdAndAssetOriginInAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                List.of(AssetOrigin.SYSTEM_TEMPLATE, AssetOrigin.USER_FLOW)
        );
        verify(repository, never()).findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc("default");
    }

    @Test
    void listCanIncludeNonProductionAssetsForGovernanceCleanup() {
        TenantContextHolder.setTenantId("default");
        KoProcessModel demoModel = model("demo-model", ProcessModelStatus.ARCHIVED);
        demoModel.setAssetOrigin(AssetOrigin.LEGACY_DEMO);
        when(repository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc("default"))
                .thenReturn(List.of(demoModel));

        var result = service.list(null, true);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().assetOrigin()).isEqualTo("LEGACY_DEMO");
        verify(repository).findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc("default");
    }

    @Test
    void updateDeployedModelReturnsDraftAndWritesLifecycleAuditDetail() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoProcessModel model = model("model-1", ProcessModelStatus.DEPLOYED);
        when(repository.findByIdAndTenantIdAndDeletedFalse("model-1", "default")).thenReturn(Optional.of(model));
        when(repository.save(any(KoProcessModel.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.update("model-1", new ProcessModelUpdateRequest(
                "Leave Approval Updated",
                "Updated draft",
                "<definitions id=\"updated\" />"
        ));

        assertThat(response.status()).isEqualTo("DRAFT");
        assertThat(response.version()).isEqualTo(2);
        assertThat(model.getUpdatedBy()).isEqualTo("admin");
        verify(auditLogService).record("PROCESS_MODEL_UPDATE", "PROCESS_MODEL", "model-1", Map.of(
                "modelKey", "leaveApproval",
                "version", 2,
                "status", "DRAFT",
                "assetOrigin", "USER_FLOW"
        ));
    }

    @Test
    void exportReturnsBpmnXmlWithModelKeyFileName() {
        TenantContextHolder.setTenantId("default");
        KoProcessModel model = model("model-1", ProcessModelStatus.DRAFT);
        model.setBpmnXml("<definitions id=\"demo\" />");
        when(repository.findByIdAndTenantIdAndDeletedFalse("model-1", "default")).thenReturn(Optional.of(model));

        var exported = service.export("model-1");

        assertThat(exported.fileName()).isEqualTo("leaveApproval.bpmn20.xml");
        assertThat(exported.bpmnXml()).isEqualTo("<definitions id=\"demo\" />");
    }

    @Test
    void deployRejectsDisabledModel() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoProcessModel model = model("model-1", ProcessModelStatus.DISABLED);
        when(repository.findByIdAndTenantIdAndDeletedFalse("model-1", "default")).thenReturn(Optional.of(model));

        assertThatThrownBy(() -> service.deploy("model-1"))
                .hasMessageContaining("Only draft process models can be deployed");

        verify(processFacade, never()).deploy(any(DeployProcessCommand.class));
        verify(auditLogService, never()).record("PROCESS_MODEL_DEPLOY", "PROCESS_MODEL", "model-1", Map.of(
                "deploymentId", "dep-1",
                "processDefinitionId", "pd-1",
                "processDefinitionKey", "leaveApproval"
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
