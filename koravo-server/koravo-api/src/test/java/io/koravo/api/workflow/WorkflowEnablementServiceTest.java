package io.koravo.api.workflow;

import io.koravo.common.api.PageResult;
import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import io.koravo.common.model.AssetOrigin;
import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.DeployProcessCommand;
import io.koravo.engine.dto.ProcessDeploymentDTO;
import io.koravo.form.domain.FormStatus;
import io.koravo.form.domain.KoFormBinding;
import io.koravo.form.domain.KoFormSchema;
import io.koravo.form.repo.FormBindingRepository;
import io.koravo.form.repo.FormSchemaRepository;
import io.koravo.form.service.FormSchemaService;
import io.koravo.form.web.FormSchemaResponse;
import io.koravo.model.domain.KoProcessModel;
import io.koravo.model.domain.ProcessModelStatus;
import io.koravo.model.repo.ProcessModelRepository;
import io.koravo.ops.audit.AuditLogQueryService;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WorkflowEnablementServiceTest {
    private final ProcessFacade processFacade = mock(ProcessFacade.class);
    private final ProcessModelRepository processModelRepository = mock(ProcessModelRepository.class);
    private final FormSchemaRepository formSchemaRepository = mock(FormSchemaRepository.class);
    private final FormBindingRepository formBindingRepository = mock(FormBindingRepository.class);
    private final FormSchemaService formSchemaService = mock(FormSchemaService.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final AuditLogQueryService auditLogQueryService = mock(AuditLogQueryService.class);
    private final WorkflowEnablementService service = new WorkflowEnablementService(
            processFacade,
            processModelRepository,
            formSchemaRepository,
            formBindingRepository,
            formSchemaService,
            auditLogService,
            auditLogQueryService
    );

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
        UserContextHolder.clear();
    }

    @Test
    void initCreatesDeploysAndBindsWorkflowAssets() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        when(processModelRepository.findFirstByTenantIdAndModelKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                WorkflowEnablementDefaults.PROCESS_KEY
        )).thenReturn(Optional.empty());
        when(formSchemaRepository.findFirstByTenantIdAndFormKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                WorkflowEnablementDefaults.FORM_KEY
        )).thenReturn(Optional.empty());
        when(processModelRepository.save(any(KoProcessModel.class))).thenAnswer(invocation -> {
            KoProcessModel model = invocation.getArgument(0);
            if (model.getId() == null) {
                model.setId("model-1");
            }
            return model;
        });
        when(formSchemaRepository.save(any(KoFormSchema.class))).thenAnswer(invocation -> {
            KoFormSchema form = invocation.getArgument(0);
            form.setId("form-1");
            return form;
        });
        when(formBindingRepository.save(any(KoFormBinding.class))).thenAnswer(invocation -> {
            KoFormBinding binding = invocation.getArgument(0);
            binding.setId("binding-1");
            return binding;
        });
        when(processFacade.deploy(new DeployProcessCommand(
                "default",
                "admin",
                WorkflowEnablementDefaults.PROCESS_KEY,
                WorkflowEnablementDefaults.PROCESS_NAME,
                WorkflowEnablementDefaults.PROCESS_KEY + ".bpmn20.xml",
                WorkflowEnablementDefaults.businessRequestBpmn()
        ))).thenReturn(new ProcessDeploymentDTO(null, "dep-1", "pd-1", WorkflowEnablementDefaults.PROCESS_KEY, 1));
        WorkflowEnablementInitResponse response = service.init();

        assertThat(response.initialized()).isTrue();
        assertThat(response.processModelId()).isEqualTo("model-1");
        assertThat(response.processDefinitionId()).isEqualTo("pd-1");
        assertThat(response.formSchemaId()).isEqualTo("form-1");
        assertThat(response.formBindingId()).isEqualTo("binding-1");
        assertThat(response.actions()).contains(
                "创建协同审批流程模型",
                "部署协同审批流程",
                "创建业务申请表",
                "绑定启动表单",
                "绑定业务申请表到多人会签"
        );
        ArgumentCaptor<KoProcessModel> modelCaptor = ArgumentCaptor.forClass(KoProcessModel.class);
        ArgumentCaptor<KoFormSchema> formCaptor = ArgumentCaptor.forClass(KoFormSchema.class);
        verify(processModelRepository, org.mockito.Mockito.atLeastOnce()).save(modelCaptor.capture());
        verify(formSchemaRepository, org.mockito.Mockito.atLeastOnce()).save(formCaptor.capture());
        assertThat(modelCaptor.getAllValues()).extracting(KoProcessModel::getAssetOrigin).contains(AssetOrigin.SYSTEM_TEMPLATE);
        assertThat(formCaptor.getAllValues()).extracting(KoFormSchema::getAssetOrigin).contains(AssetOrigin.SYSTEM_TEMPLATE);
        verify(auditLogService).record(eq("WORKFLOW_ENABLEMENT_INIT"), eq("WORKFLOW_ENABLEMENT"), eq("collaborative-approval"), any(Map.class));
    }

    @Test
    void initUpdatesExistingWrongBindingInsteadOfCreatingDuplicate() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoProcessModel model = deployedModel();
        KoFormSchema form = activeForm();
        KoFormBinding startBinding = binding("start-binding", "form-1", 2, WorkflowEnablementDefaults.START_FORM_TASK_KEY);
        KoFormBinding oldBinding = binding("binding-1", "old-form", 1, WorkflowEnablementDefaults.PRIMARY_TASK_KEY);
        when(processModelRepository.findFirstByTenantIdAndModelKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                WorkflowEnablementDefaults.PROCESS_KEY
        )).thenReturn(Optional.of(model));
        when(formSchemaRepository.findFirstByTenantIdAndFormKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                WorkflowEnablementDefaults.FORM_KEY
        )).thenReturn(Optional.of(form));
        when(formBindingRepository.findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "pd-1",
                WorkflowEnablementDefaults.START_FORM_TASK_KEY
        )).thenReturn(Optional.of(startBinding));
        when(formBindingRepository.findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "pd-1",
                WorkflowEnablementDefaults.PRIMARY_TASK_KEY
        )).thenReturn(Optional.of(oldBinding));
        when(formBindingRepository.findFirstByTenantIdAndProcessModelIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "model-1",
                WorkflowEnablementDefaults.PRIMARY_TASK_KEY
        )).thenReturn(Optional.empty());
        when(formBindingRepository.save(any(KoFormBinding.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WorkflowEnablementInitResponse response = service.init();

        assertThat(response.formBindingId()).isEqualTo("start-binding");
        assertThat(oldBinding.getFormSchemaId()).isEqualTo("form-1");
        assertThat(oldBinding.getFormSchemaVersion()).isEqualTo(2);
        assertThat(oldBinding.getUpdatedBy()).isEqualTo("admin");
        assertThat(response.actions()).contains("更新审批任务表单绑定");
        verify(formBindingRepository).save(oldBinding);
    }

    @Test
    void initMigratesLegacyDefaultProcessDefinitionBeforeStart() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoProcessModel model = deployedModel();
        model.setBpmnXml(legacyManagerApprovalBpmn());
        KoFormSchema form = activeForm();
        when(processModelRepository.findFirstByTenantIdAndModelKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                WorkflowEnablementDefaults.PROCESS_KEY
        )).thenReturn(Optional.of(model));
        when(formSchemaRepository.findFirstByTenantIdAndFormKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                WorkflowEnablementDefaults.FORM_KEY
        )).thenReturn(Optional.of(form));
        when(processFacade.deploy(new DeployProcessCommand(
                "default",
                "admin",
                WorkflowEnablementDefaults.PROCESS_KEY,
                WorkflowEnablementDefaults.PROCESS_NAME,
                WorkflowEnablementDefaults.PROCESS_KEY + ".bpmn20.xml",
                WorkflowEnablementDefaults.businessRequestBpmn()
        ))).thenReturn(new ProcessDeploymentDTO(null, "dep-2", "pd-2", WorkflowEnablementDefaults.PROCESS_KEY, 2));
        when(formBindingRepository.findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "pd-2",
                WorkflowEnablementDefaults.START_FORM_TASK_KEY
        )).thenReturn(Optional.empty());
        when(formBindingRepository.findFirstByTenantIdAndProcessModelIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "model-1",
                WorkflowEnablementDefaults.START_FORM_TASK_KEY
        )).thenReturn(Optional.empty());
        when(formBindingRepository.findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "pd-2",
                WorkflowEnablementDefaults.PRIMARY_TASK_KEY
        )).thenReturn(Optional.empty());
        when(formBindingRepository.findFirstByTenantIdAndProcessModelIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "model-1",
                WorkflowEnablementDefaults.PRIMARY_TASK_KEY
        )).thenReturn(Optional.empty());
        when(processModelRepository.save(any(KoProcessModel.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(formBindingRepository.save(any(KoFormBinding.class))).thenAnswer(invocation -> {
            KoFormBinding binding = invocation.getArgument(0);
            binding.setId(binding.getTaskDefinitionKey() + "-binding");
            return binding;
        });

        WorkflowEnablementInitResponse response = service.init();

        assertThat(model.getBpmnXml()).contains(WorkflowEnablementDefaults.BUSINESS_ACCEPTANCE_TASK_KEY);
        assertThat(model.getBpmnXml()).doesNotContain("managerApprover", "financeApprover");
        assertThat(model.getFlowableDefinitionId()).isEqualTo("pd-2");
        assertThat(response.processDefinitionId()).isEqualTo("pd-2");
        assertThat(response.actions()).contains(
                "更新协同审批流程定义",
                "部署协同审批流程",
                "绑定启动表单",
                "绑定业务申请表到多人会签"
        );
    }

    @Test
    void initMigratesLegacyApprovalFieldsToApprovalUsers() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoProcessModel model = deployedModel();
        KoFormSchema form = activeForm();
        form.setSchemaJson(legacyApprovalFormSchema());
        form.setUiSchemaJson(legacyApprovalFormUiSchema());
        KoFormBinding startBinding = binding("start-binding", "form-1", 2, WorkflowEnablementDefaults.START_FORM_TASK_KEY);
        KoFormBinding approvalBinding = binding("approval-binding", "form-1", 2, WorkflowEnablementDefaults.PRIMARY_TASK_KEY);
        when(processModelRepository.findFirstByTenantIdAndModelKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                WorkflowEnablementDefaults.PROCESS_KEY
        )).thenReturn(Optional.of(model));
        when(formSchemaRepository.findFirstByTenantIdAndFormKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                WorkflowEnablementDefaults.FORM_KEY
        )).thenReturn(Optional.of(form));
        when(formSchemaRepository.save(form)).thenReturn(form);
        when(formBindingRepository.findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "pd-1",
                WorkflowEnablementDefaults.START_FORM_TASK_KEY
        )).thenReturn(Optional.of(startBinding));
        when(formBindingRepository.findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "pd-1",
                WorkflowEnablementDefaults.PRIMARY_TASK_KEY
        )).thenReturn(Optional.of(approvalBinding));
        when(formBindingRepository.save(any(KoFormBinding.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WorkflowEnablementInitResponse response = service.init();

        assertThat(form.getSchemaJson()).contains("\"approvalUsers\"");
        assertThat(form.getSchemaJson()).doesNotContain("\"managerApprover\"", "\"financeApprover\"");
        assertThat(form.getUiSchemaJson()).contains("\"approvalUsers\"");
        assertThat(form.getVersion()).isEqualTo(3);
        assertThat(startBinding.getFormSchemaVersion()).isEqualTo(3);
        assertThat(approvalBinding.getFormSchemaVersion()).isEqualTo(3);
        assertThat(response.actions()).contains(
                "更新业务申请表为多人会签",
                "更新启动表单绑定",
                "更新审批任务表单绑定"
        );
    }

    @Test
    void statusReturnsInitializedWhenWorkflowAssetsAreReady() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoProcessModel model = deployedModel();
        KoFormSchema form = activeForm();
        KoFormBinding startBinding = binding("start-binding", "form-1", 2, WorkflowEnablementDefaults.START_FORM_TASK_KEY);
        KoFormBinding businessBinding = binding("business-binding", "form-1", 2, WorkflowEnablementDefaults.PRIMARY_TASK_KEY);
        when(processModelRepository.findFirstByTenantIdAndModelKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                WorkflowEnablementDefaults.PROCESS_KEY
        )).thenReturn(Optional.of(model));
        when(formSchemaRepository.findFirstByTenantIdAndFormKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                WorkflowEnablementDefaults.FORM_KEY
        )).thenReturn(Optional.of(form));
        when(formBindingRepository.findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "pd-1",
                WorkflowEnablementDefaults.START_FORM_TASK_KEY
        )).thenReturn(Optional.of(startBinding));
        when(formBindingRepository.findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "pd-1",
                WorkflowEnablementDefaults.PRIMARY_TASK_KEY
        )).thenReturn(Optional.of(businessBinding));
        when(processFacade.queryMyTasks(any())).thenReturn(PageResult.of(java.util.List.of(), 0, 1, 1));
        when(auditLogQueryService.query(null, null, null, null, null, null, null, 1, 1))
                .thenReturn(PageResult.of(java.util.List.of(), 3, 1, 1));

        WorkflowEnablementStatusResponse response = service.status();

        assertThat(response.initialized()).isTrue();
        assertThat(response.tenantId()).isEqualTo("default");
        assertThat(response.userId()).isEqualTo("admin");
        assertThat(response.message()).isEqualTo("流程配置已就绪");
        assertThat(response.process().ready()).isTrue();
        assertThat(response.form().ready()).isTrue();
        assertThat(response.binding().ready()).isTrue();
        assertThat(response.audit().count()).isEqualTo(3);
        assertThat(response.defaultStartVariables()).containsEntry("applicant", "业务申请专员");
        assertThat(response.defaultStartVariables()).containsEntry("department", "业务一部");
        assertThat(response.defaultStartVariables()).containsEntry("approvalUsers", List.of("manager", "finance"));
        verify(processFacade, never()).deploy(any());
    }

    @Test
    void startableProcessesOnlyReturnsDeployedModelsWithActiveStartForms() {
        TenantContextHolder.setTenantId("default");
        KoProcessModel model = deployedModel();
        KoProcessModel retiredModel = deployedModel("retired-model", "purchaseApproval", "历史流程资产");
        KoFormSchema form = activeForm();
        KoFormBinding startBinding = binding("start-binding", "form-1", 2, WorkflowEnablementDefaults.START_FORM_TASK_KEY);
        KoFormBinding taskBinding = binding("task-binding", "form-1", 2, WorkflowEnablementDefaults.BUSINESS_ACCEPTANCE_TASK_KEY);
        KoFormBinding retiredBinding = binding("retired-binding", "form-1", 2, WorkflowEnablementDefaults.START_FORM_TASK_KEY);
        retiredBinding.setProcessModelId("retired-model");
        retiredBinding.setProcessDefinitionId("purchaseApproval:1:retired");

        when(processModelRepository.findByTenantIdAndStatusAndDeletedFalseOrderByUpdatedAtDesc("default", ProcessModelStatus.DEPLOYED))
                .thenReturn(List.of(model, retiredModel));
        when(formBindingRepository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc("default"))
                .thenReturn(List.of(startBinding, taskBinding, retiredBinding));
        when(formSchemaRepository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc("default"))
                .thenReturn(List.of(form));
        when(formSchemaService.get("form-1", 2)).thenReturn(formResponse(form));

        List<StartableWorkflowResponse> response = service.startableProcesses();

        assertThat(response).hasSize(1);
        assertThat(response.get(0).processDefinitionKey()).isEqualTo(WorkflowEnablementDefaults.PROCESS_KEY);
        assertThat(response.get(0).bpmnXml()).contains(WorkflowEnablementDefaults.PROCESS_KEY);
        assertThat(response.get(0).startFormSchema().id()).isEqualTo("form-1");
    }

    @Test
    void startableProcessesRequireTaskFormBindings() {
        TenantContextHolder.setTenantId("default");
        KoProcessModel model = deployedModel();
        KoFormSchema form = activeForm();
        KoFormBinding startBinding = binding("start-binding", "form-1", 2, WorkflowEnablementDefaults.START_FORM_TASK_KEY);

        when(processModelRepository.findByTenantIdAndStatusAndDeletedFalseOrderByUpdatedAtDesc("default", ProcessModelStatus.DEPLOYED))
                .thenReturn(List.of(model));
        when(formBindingRepository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc("default"))
                .thenReturn(List.of(startBinding));
        when(formSchemaRepository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc("default"))
                .thenReturn(List.of(form));

        List<StartableWorkflowResponse> response = service.startableProcesses();

        assertThat(response).isEmpty();
    }

    @Test
    void startableProcessesFallsBackToCurrentFormWhenBoundVersionIsMissing() {
        TenantContextHolder.setTenantId("default");
        KoProcessModel model = deployedModel();
        KoFormSchema form = activeForm();
        KoFormBinding startBinding = binding("start-binding", "form-1", 1, WorkflowEnablementDefaults.START_FORM_TASK_KEY);
        KoFormBinding taskBinding = binding("task-binding", "form-1", 1, WorkflowEnablementDefaults.BUSINESS_ACCEPTANCE_TASK_KEY);

        when(processModelRepository.findByTenantIdAndStatusAndDeletedFalseOrderByUpdatedAtDesc("default", ProcessModelStatus.DEPLOYED))
                .thenReturn(List.of(model));
        when(formBindingRepository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc("default"))
                .thenReturn(List.of(startBinding, taskBinding));
        when(formSchemaRepository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc("default"))
                .thenReturn(List.of(form));
        when(formSchemaService.get("form-1", 1))
                .thenThrow(new BusinessException(ErrorCode.FORM_SCHEMA_NOT_FOUND, "Form schema version not found"));
        when(formSchemaService.get("form-1")).thenReturn(formResponse(form));

        List<StartableWorkflowResponse> response = service.startableProcesses();

        assertThat(response).hasSize(1);
        assertThat(response.get(0).startFormSchema().id()).isEqualTo("form-1");
        assertThat(response.get(0).startFormSchema().version()).isEqualTo(form.getVersion());
    }

    @Test
    void initArchivesRetiredWorkflowAssetsWithoutDeletingCurrentDefaultAssets() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoProcessModel model = deployedModel();
        KoFormSchema form = activeForm();
        KoFormBinding startBinding = binding("start-binding", "form-1", 2, WorkflowEnablementDefaults.START_FORM_TASK_KEY);
        KoFormBinding businessBinding = binding("business-binding", "form-1", 2, WorkflowEnablementDefaults.BUSINESS_ACCEPTANCE_TASK_KEY);
        KoFormBinding financeBinding = binding("finance-binding", "form-1", 2, WorkflowEnablementDefaults.FINANCE_ACCEPTANCE_TASK_KEY);
        KoProcessModel retiredModel = deployedModel("retired-model", "leaveApproval", "历史流程资产");
        KoFormSchema retiredForm = activeForm("retired-form", "leave-form", "历史表单资产");

        when(processModelRepository.findFirstByTenantIdAndModelKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                WorkflowEnablementDefaults.PROCESS_KEY
        )).thenReturn(Optional.of(model));
        when(formSchemaRepository.findFirstByTenantIdAndFormKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                WorkflowEnablementDefaults.FORM_KEY
        )).thenReturn(Optional.of(form));
        when(formBindingRepository.findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "pd-1",
                WorkflowEnablementDefaults.START_FORM_TASK_KEY
        )).thenReturn(Optional.of(startBinding));
        when(formBindingRepository.findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "pd-1",
                WorkflowEnablementDefaults.BUSINESS_ACCEPTANCE_TASK_KEY
        )).thenReturn(Optional.of(businessBinding));
        when(formBindingRepository.findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "pd-1",
                WorkflowEnablementDefaults.FINANCE_ACCEPTANCE_TASK_KEY
        )).thenReturn(Optional.of(financeBinding));
        when(processModelRepository.findByTenantIdAndModelKeyInAndDeletedFalseOrderByUpdatedAtDesc(eq("default"), any()))
                .thenReturn(List.of(model, retiredModel));
        when(formSchemaRepository.findByTenantIdAndFormKeyInAndDeletedFalseOrderByUpdatedAtDesc(eq("default"), any()))
                .thenReturn(List.of(form, retiredForm));
        when(processModelRepository.save(any(KoProcessModel.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(formSchemaRepository.save(any(KoFormSchema.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WorkflowEnablementInitResponse response = service.init();

        assertThat(model.getStatus()).isEqualTo(ProcessModelStatus.DEPLOYED);
        assertThat(model.getAssetOrigin()).isEqualTo(AssetOrigin.SYSTEM_TEMPLATE);
        assertThat(form.getStatus()).isEqualTo(FormStatus.ACTIVE);
        assertThat(form.getAssetOrigin()).isEqualTo(AssetOrigin.SYSTEM_TEMPLATE);
        assertThat(retiredModel.getStatus()).isEqualTo(ProcessModelStatus.ARCHIVED);
        assertThat(retiredModel.getAssetOrigin()).isEqualTo(AssetOrigin.LEGACY_DEMO);
        assertThat(retiredModel.getUpdatedBy()).isEqualTo("admin");
        assertThat(retiredForm.getStatus()).isEqualTo(FormStatus.DISABLED);
        assertThat(retiredForm.getAssetOrigin()).isEqualTo(AssetOrigin.LEGACY_DEMO);
        assertThat(retiredForm.getUpdatedBy()).isEqualTo("admin");
        assertThat(response.actions()).contains(
                "归档历史流程资产：历史流程资产",
                "停用历史表单资产：历史表单资产"
        );
    }

    private KoProcessModel deployedModel() {
        return deployedModel("model-1", WorkflowEnablementDefaults.PROCESS_KEY, WorkflowEnablementDefaults.PROCESS_NAME);
    }

    private KoProcessModel deployedModel(String id, String modelKey, String modelName) {
        KoProcessModel model = new KoProcessModel();
        model.setId(id);
        model.setTenantId("default");
        model.setModelKey(modelKey);
        model.setModelName(modelName);
        model.setModelType("BPMN");
        model.setVersion(1);
        model.setStatus(ProcessModelStatus.DEPLOYED);
        model.setFlowableDeploymentId("dep-1");
        model.setFlowableDefinitionId(WorkflowEnablementDefaults.PROCESS_KEY.equals(modelKey) ? "pd-1" : modelKey + ":1:retired");
        model.setBpmnXml(WorkflowEnablementDefaults.businessRequestBpmn());
        return model;
    }

    private String legacyManagerApprovalBpmn() {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
                             xmlns:flowable="http://flowable.org/bpmn">
                  <process id="collaborativeApproval" name="协同审批流程" isExecutable="true">
                    <startEvent id="start"/>
                    <sequenceFlow id="flow_start_review" sourceRef="start" targetRef="businessReviewTask"/>
                    <userTask id="businessReviewTask" name="业务审批" flowable:assignee="${managerApprover}"/>
                    <sequenceFlow id="flow_review_finance" sourceRef="businessReviewTask" targetRef="financeReviewTask"/>
                    <userTask id="financeReviewTask" name="财务复核" flowable:assignee="${financeApprover}"/>
                    <sequenceFlow id="flow_finance_end" sourceRef="financeReviewTask" targetRef="end"/>
                    <endEvent id="end"/>
                  </process>
                </definitions>
                """;
    }

    private String legacyApprovalFormSchema() {
        return """
                {
                  "type": "object",
                  "required": ["applicant", "department", "subject", "businessDescription", "managerApprover", "financeApprover"],
                  "properties": {
                    "applicant": { "type": "string", "title": "申请人" },
                    "department": { "type": "string", "title": "申请部门" },
                    "subject": { "type": "string", "title": "申请主题" },
                    "businessDescription": { "type": "string", "title": "事项内容", "ui:widget": "textarea" },
                    "managerApprover": { "type": "string", "title": "业务审批人" },
                    "financeApprover": { "type": "string", "title": "财务复核人" }
                  }
                }
                """;
    }

    private String legacyApprovalFormUiSchema() {
        return """
                {
                  "applicant": { "widget": "organizationProfile" },
                  "department": { "widget": "organizationProfile" },
                  "managerApprover": { "widget": "organizationMember" },
                  "financeApprover": { "widget": "organizationMember" },
                  "businessDescription": { "widget": "textarea" }
                }
                """;
    }

    private KoFormSchema activeForm() {
        return activeForm("form-1", WorkflowEnablementDefaults.FORM_KEY, WorkflowEnablementDefaults.FORM_NAME);
    }

    private KoFormSchema activeForm(String id, String formKey, String formName) {
        KoFormSchema form = new KoFormSchema();
        form.setId(id);
        form.setTenantId("default");
        form.setFormKey(formKey);
        form.setFormName(formName);
        form.setVersion(2);
        form.setSchemaJson(WorkflowEnablementDefaults.businessRequestFormSchema());
        form.setUiSchemaJson(WorkflowEnablementDefaults.businessRequestFormUiSchema());
        form.setStatus(FormStatus.ACTIVE);
        return form;
    }

    private KoFormBinding binding(String id, String formSchemaId, int version) {
        return binding(id, formSchemaId, version, WorkflowEnablementDefaults.PRIMARY_TASK_KEY);
    }

    private KoFormBinding binding(String id, String formSchemaId, int version, String taskDefinitionKey) {
        KoFormBinding binding = new KoFormBinding();
        binding.setId(id);
        binding.setTenantId("default");
        binding.setProcessModelId("model-1");
        binding.setProcessDefinitionId("pd-1");
        binding.setTaskDefinitionKey(taskDefinitionKey);
        binding.setFormSchemaId(formSchemaId);
        binding.setFormSchemaVersion(version);
        return binding;
    }

    private FormSchemaResponse formResponse(KoFormSchema form) {
        return new FormSchemaResponse(
                form.getId(),
                form.getFormKey(),
                form.getFormName(),
                form.getVersion(),
                form.getSchemaJson(),
                form.getUiSchemaJson(),
                form.getStatus().name(),
                "SYSTEM_TEMPLATE"
        );
    }
}
