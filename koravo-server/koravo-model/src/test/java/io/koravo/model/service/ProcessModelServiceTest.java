package io.koravo.model.service;

import io.koravo.common.model.AssetOrigin;
import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.DeployProcessCommand;
import io.koravo.engine.dto.ProcessDeploymentDTO;
import io.koravo.form.domain.KoFormBinding;
import io.koravo.form.repo.FormBindingRepository;
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

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
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
    private final FormBindingRepository formBindingRepository = mock(FormBindingRepository.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final BpmnValidationService validationService = mock(BpmnValidationService.class);
    private final ProcessModelService service = new ProcessModelService(
            processFacade,
            repository,
            formBindingRepository,
            auditLogService,
            validationService
    );

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
                "processDefinitionKey", "leaveApproval",
                "assetOrigin", "USER_FLOW"
        ));
    }

    @Test
    void directDeployCanPersistVerificationAssetOrigin() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        String bpmnXml = "<definitions><process id=\"enterpriseApproval30\" /></definitions>";
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "enterprise-approval-30-node.bpmn20.xml",
                "text/xml",
                bpmnXml.getBytes()
        );
        when(validationService.validate(bpmnXml)).thenReturn(new BpmnValidationResult(true, List.of(), List.of()));
        when(processFacade.deploy(new DeployProcessCommand(
                "default",
                "admin",
                "enterprise_approval_30_node",
                "企业级审批链路验收",
                "enterprise-approval-30-node.bpmn20.xml",
                bpmnXml
        ))).thenReturn(new ProcessDeploymentDTO(
                null,
                "dep-fixture",
                "enterpriseApproval30:1:pd",
                "enterpriseApproval30",
                1
        ));
        when(repository.save(any(KoProcessModel.class))).thenAnswer(invocation -> {
            KoProcessModel saved = invocation.getArgument(0);
            saved.setId("fixture-model-1");
            return saved;
        });

        var response = service.deploy("企业级审批链路验收", file, AssetOrigin.TEST_FIXTURE);

        assertThat(response.platformModelId()).isEqualTo("fixture-model-1");
        ArgumentCaptor<KoProcessModel> modelCaptor = ArgumentCaptor.forClass(KoProcessModel.class);
        verify(repository).save(modelCaptor.capture());
        assertThat(modelCaptor.getValue().getAssetOrigin()).isEqualTo(AssetOrigin.TEST_FIXTURE);
    }

    @Test
    void directDeployAcceptsEnterpriseApprovalExampleFromUserUpload() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        String bpmnXml = readEnterpriseApprovalBpmn();
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "enterprise-approval-30-node.bpmn20.xml",
                "text/xml",
                bpmnXml.getBytes()
        );
        ProcessModelService realValidationService = new ProcessModelService(
                processFacade,
                repository,
                formBindingRepository,
                auditLogService,
                new BpmnValidationService()
        );
        when(processFacade.deploy(any(DeployProcessCommand.class))).thenReturn(new ProcessDeploymentDTO(
                null,
                "dep-enterprise",
                "enterpriseApproval30:1:pd",
                "enterpriseApproval30",
                1
        ));
        when(repository.save(any(KoProcessModel.class))).thenAnswer(invocation -> {
            KoProcessModel saved = invocation.getArgument(0);
            saved.setId("enterprise-model-1");
            return saved;
        });

        var response = realValidationService.deploy("企业级多部门审批", file);

        assertThat(response.platformModelId()).isEqualTo("enterprise-model-1");
        assertThat(response.processDefinitionKey()).isEqualTo("enterpriseApproval30");
        assertThat(bpmnXml.split("<userTask ", -1).length - 1).isEqualTo(34);
        assertThat(bpmnXml.split("<subProcess ", -1).length - 1).isEqualTo(4);
        assertThat(bpmnXml.split("candidateGroups=", -1).length - 1).isEqualTo(14);

        ArgumentCaptor<DeployProcessCommand> deployCaptor = ArgumentCaptor.forClass(DeployProcessCommand.class);
        verify(processFacade).deploy(deployCaptor.capture());
        assertThat(deployCaptor.getValue().modelKey()).isEqualTo("enterprise_approval_30_node");
        assertThat(deployCaptor.getValue().modelName()).isEqualTo("企业级多部门审批");
        assertThat(deployCaptor.getValue().fileName()).isEqualTo("enterprise-approval-30-node.bpmn20.xml");
        assertThat(deployCaptor.getValue().bpmnXml()).isEqualTo(bpmnXml);

        ArgumentCaptor<KoProcessModel> modelCaptor = ArgumentCaptor.forClass(KoProcessModel.class);
        verify(repository).save(modelCaptor.capture());
        assertThat(modelCaptor.getValue().getModelKey()).isEqualTo("enterpriseApproval30");
        assertThat(modelCaptor.getValue().getStatus()).isEqualTo(ProcessModelStatus.DEPLOYED);
        assertThat(modelCaptor.getValue().getAssetOrigin()).isEqualTo(AssetOrigin.USER_FLOW);
        verify(auditLogService).record("PROCESS_MODEL_DEPLOY", "PROCESS_MODEL", "enterprise-model-1", Map.of(
                "deploymentId", "dep-enterprise",
                "processDefinitionId", "enterpriseApproval30:1:pd",
                "processDefinitionKey", "enterpriseApproval30",
                "assetOrigin", "USER_FLOW"
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
        when(repository.findByTenantIdAndStatusNotAndAssetOriginInAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                ProcessModelStatus.ARCHIVED,
                List.of(AssetOrigin.SYSTEM_TEMPLATE, AssetOrigin.USER_FLOW)
        )).thenReturn(List.of(model));

        var result = service.list(null);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().id()).isEqualTo("model-1");
        verify(repository).findByTenantIdAndStatusNotAndAssetOriginInAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                ProcessModelStatus.ARCHIVED,
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
    void updateAssetOriginWritesLifecycleAuditDetail() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoProcessModel model = model("fixture-model", ProcessModelStatus.DEPLOYED);
        when(repository.findByIdAndTenantIdAndDeletedFalse("fixture-model", "default")).thenReturn(Optional.of(model));
        when(repository.save(any(KoProcessModel.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.updateAssetOrigin("fixture-model", AssetOrigin.TEST_FIXTURE);

        assertThat(response.assetOrigin()).isEqualTo("TEST_FIXTURE");
        assertThat(model.getUpdatedBy()).isEqualTo("admin");
        verify(repository).save(model);
        verify(auditLogService).record("PROCESS_MODEL_ASSET_ORIGIN_UPDATE", "PROCESS_MODEL", "fixture-model", Map.of(
                "modelKey", "leaveApproval",
                "version", 1,
                "status", "DEPLOYED",
                "assetOrigin", "TEST_FIXTURE"
        ));
    }

    @Test
    void restoreDraftCopiesHistoricalVersionAsNextDraft() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoProcessModel source = model("model-v2", ProcessModelStatus.ARCHIVED);
        source.setVersion(2);
        source.setDescription("历史版本");
        source.setBpmnXml("<definitions id=\"v2\" />");
        KoProcessModel latest = model("model-v5", ProcessModelStatus.DEPLOYED);
        latest.setVersion(5);
        when(repository.findByIdAndTenantIdAndDeletedFalse("model-v2", "default")).thenReturn(Optional.of(source));
        when(repository.findByTenantIdAndModelKeyAndDeletedFalseOrderByVersionDescUpdatedAtDesc("default", "leaveApproval"))
                .thenReturn(List.of(latest, source));
        when(repository.save(any(KoProcessModel.class))).thenAnswer(invocation -> {
            KoProcessModel saved = invocation.getArgument(0);
            saved.setId("model-v6");
            return saved;
        });

        var response = service.restoreDraft("model-v2");

        assertThat(response.id()).isEqualTo("model-v6");
        assertThat(response.version()).isEqualTo(6);
        assertThat(response.status()).isEqualTo("DRAFT");
        assertThat(response.bpmnXml()).isEqualTo("<definitions id=\"v2\" />");
        ArgumentCaptor<KoProcessModel> modelCaptor = ArgumentCaptor.forClass(KoProcessModel.class);
        verify(repository).save(modelCaptor.capture());
        assertThat(modelCaptor.getValue().getFlowableDefinitionId()).isNull();
        assertThat(modelCaptor.getValue().getUpdatedBy()).isEqualTo("admin");
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> detailCaptor = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).record(
                org.mockito.ArgumentMatchers.eq("PROCESS_MODEL_RESTORE_DRAFT"),
                org.mockito.ArgumentMatchers.eq("PROCESS_MODEL"),
                org.mockito.ArgumentMatchers.eq("model-v6"),
                detailCaptor.capture()
        );
        assertThat(detailCaptor.getValue()).containsEntry("modelKey", "leaveApproval");
        assertThat(detailCaptor.getValue()).containsEntry("version", 6);
        assertThat(detailCaptor.getValue()).containsEntry("status", "DRAFT");
        assertThat(detailCaptor.getValue()).containsEntry("sourceModelId", "model-v2");
        assertThat(detailCaptor.getValue()).containsEntry("sourceVersion", 2);
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
    void deployDraftRequiresStartFormBinding() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoProcessModel model = model("model-1", ProcessModelStatus.DRAFT);
        model.setBpmnXml(validApprovalBpmn());
        when(repository.findByIdAndTenantIdAndDeletedFalse("model-1", "default")).thenReturn(Optional.of(model));
        when(validationService.validate(model.getBpmnXml())).thenReturn(new BpmnValidationResult(true, List.of(), List.of()));
        when(formBindingRepository.findByTenantIdAndProcessModelIdAndDeletedFalseOrderByUpdatedAtDesc("default", "model-1"))
                .thenReturn(List.of(taskBinding("approveTask")));

        assertThatThrownBy(() -> service.deploy("model-1"))
                .hasMessageContaining("缺少启动表单绑定");

        verify(processFacade, never()).deploy(any(DeployProcessCommand.class));
    }

    @Test
    void deployDraftRequiresTaskFormBindings() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoProcessModel model = model("model-1", ProcessModelStatus.DRAFT);
        model.setBpmnXml(validApprovalBpmn());
        when(repository.findByIdAndTenantIdAndDeletedFalse("model-1", "default")).thenReturn(Optional.of(model));
        when(validationService.validate(model.getBpmnXml())).thenReturn(new BpmnValidationResult(true, List.of(), List.of()));
        when(formBindingRepository.findByTenantIdAndProcessModelIdAndDeletedFalseOrderByUpdatedAtDesc("default", "model-1"))
                .thenReturn(List.of(startBinding()));

        assertThatThrownBy(() -> service.deploy("model-1"))
                .hasMessageContaining("缺少任务表单绑定 审批");

        verify(processFacade, never()).deploy(any(DeployProcessCommand.class));
    }

    @Test
    void deployDraftRunsWhenReleaseBindingsAreReady() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoProcessModel model = model("model-1", ProcessModelStatus.DRAFT);
        model.setBpmnXml(validApprovalBpmn());
        ProcessDeploymentDTO deployment = new ProcessDeploymentDTO(
                null,
                "dep-1",
                "pd-1",
                "leaveApproval",
                2
        );
        when(repository.findByIdAndTenantIdAndDeletedFalse("model-1", "default")).thenReturn(Optional.of(model));
        when(validationService.validate(model.getBpmnXml())).thenReturn(new BpmnValidationResult(true, List.of(), List.of()));
        when(formBindingRepository.findByTenantIdAndProcessModelIdAndDeletedFalseOrderByUpdatedAtDesc("default", "model-1"))
                .thenReturn(List.of(startBinding(), taskBinding("approveTask")));
        when(processFacade.deploy(new DeployProcessCommand(
                "default",
                "admin",
                "leaveApproval",
                "Leave Approval",
                "leaveApproval.bpmn20.xml",
                model.getBpmnXml()
        ))).thenReturn(deployment);
        when(repository.save(any(KoProcessModel.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.deploy("model-1");

        assertThat(response.model().status()).isEqualTo("DEPLOYED");
        assertThat(response.model().flowableDefinitionId()).isEqualTo("pd-1");
        verify(repository).save(model);
        verify(auditLogService).record("PROCESS_MODEL_DEPLOY", "PROCESS_MODEL", "model-1", Map.of(
                "deploymentId", "dep-1",
                "processDefinitionId", "pd-1",
                "processDefinitionKey", "leaveApproval",
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
                "processDefinitionKey", "leaveApproval",
                "assetOrigin", "USER_FLOW"
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

    private KoFormBinding startBinding() {
        return binding("__START__");
    }

    private KoFormBinding taskBinding(String taskDefinitionKey) {
        return binding(taskDefinitionKey);
    }

    private KoFormBinding binding(String taskDefinitionKey) {
        KoFormBinding binding = new KoFormBinding();
        binding.setId("binding-" + taskDefinitionKey);
        binding.setTenantId("default");
        binding.setProcessModelId("model-1");
        binding.setTaskDefinitionKey(taskDefinitionKey);
        binding.setFormSchemaId("form-1");
        binding.setFormSchemaVersion(1);
        return binding;
    }

    private String validApprovalBpmn() {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
                             xmlns:flowable="http://flowable.org/bpmn">
                  <process id="leaveApproval" isExecutable="true">
                    <startEvent id="start" />
                    <userTask id="approveTask" name="审批" flowable:assignee="${approver}" />
                    <endEvent id="end" />
                  </process>
                </definitions>
                """;
    }

    private static String readEnterpriseApprovalBpmn() {
        Path directory = Path.of(System.getProperty("user.dir")).toAbsolutePath();
        while (directory != null) {
            Path candidate = directory.resolve("examples/bpmn/enterprise-approval-30-node.bpmn20.xml");
            if (Files.exists(candidate)) {
                try {
                    return Files.readString(candidate);
                } catch (IOException e) {
                    throw new UncheckedIOException("Failed to read enterprise approval BPMN example", e);
                }
            }
            directory = directory.getParent();
        }
        throw new IllegalStateException("examples/bpmn/enterprise-approval-30-node.bpmn20.xml not found");
    }
}
