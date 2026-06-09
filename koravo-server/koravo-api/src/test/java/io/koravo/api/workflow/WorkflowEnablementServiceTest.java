package io.koravo.api.workflow;

import io.koravo.common.api.PageResult;
import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.DeployProcessCommand;
import io.koravo.engine.dto.ProcessDeploymentDTO;
import io.koravo.form.domain.FormStatus;
import io.koravo.form.domain.KoFormBinding;
import io.koravo.form.domain.KoFormSchema;
import io.koravo.form.repo.FormBindingRepository;
import io.koravo.form.repo.FormSchemaRepository;
import io.koravo.model.domain.KoProcessModel;
import io.koravo.model.domain.ProcessModelStatus;
import io.koravo.model.repo.ProcessModelRepository;
import io.koravo.ops.audit.AuditLogQueryService;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

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
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final AuditLogQueryService auditLogQueryService = mock(AuditLogQueryService.class);
    private final WorkflowEnablementService service = new WorkflowEnablementService(
            processFacade,
            processModelRepository,
            formSchemaRepository,
            formBindingRepository,
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
        when(formBindingRepository.findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "pd-1",
                WorkflowEnablementDefaults.FINANCE_ACCEPTANCE_TASK_KEY
        )).thenReturn(Optional.empty());
        when(formBindingRepository.findFirstByTenantIdAndProcessModelIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "model-1",
                WorkflowEnablementDefaults.FINANCE_ACCEPTANCE_TASK_KEY
        )).thenReturn(Optional.empty());

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
                "绑定业务申请表到业务审批",
                "绑定业务申请表到财务复核"
        );
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
        when(formBindingRepository.findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "pd-1",
                WorkflowEnablementDefaults.FINANCE_ACCEPTANCE_TASK_KEY
        )).thenReturn(Optional.empty());
        when(formBindingRepository.findFirstByTenantIdAndProcessModelIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "model-1",
                WorkflowEnablementDefaults.FINANCE_ACCEPTANCE_TASK_KEY
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
    void statusReturnsInitializedWhenWorkflowAssetsAreReady() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoProcessModel model = deployedModel();
        KoFormSchema form = activeForm();
        KoFormBinding startBinding = binding("start-binding", "form-1", 2, WorkflowEnablementDefaults.START_FORM_TASK_KEY);
        KoFormBinding businessBinding = binding("business-binding", "form-1", 2, WorkflowEnablementDefaults.PRIMARY_TASK_KEY);
        KoFormBinding financeBinding = binding("finance-binding", "form-1", 2, WorkflowEnablementDefaults.FINANCE_ACCEPTANCE_TASK_KEY);
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
        when(formBindingRepository.findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "pd-1",
                WorkflowEnablementDefaults.FINANCE_ACCEPTANCE_TASK_KEY
        )).thenReturn(Optional.of(financeBinding));
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
        assertThat(response.defaultStartVariables()).containsEntry("managerApprover", "manager");
        assertThat(response.defaultStartVariables()).containsEntry("financeApprover", "finance");
        verify(processFacade, never()).deploy(any());
    }

    private KoProcessModel deployedModel() {
        KoProcessModel model = new KoProcessModel();
        model.setId("model-1");
        model.setTenantId("default");
        model.setModelKey(WorkflowEnablementDefaults.PROCESS_KEY);
        model.setModelName(WorkflowEnablementDefaults.PROCESS_NAME);
        model.setModelType("BPMN");
        model.setVersion(1);
        model.setStatus(ProcessModelStatus.DEPLOYED);
        model.setFlowableDeploymentId("dep-1");
        model.setFlowableDefinitionId("pd-1");
        model.setBpmnXml(WorkflowEnablementDefaults.businessRequestBpmn());
        return model;
    }

    private KoFormSchema activeForm() {
        KoFormSchema form = new KoFormSchema();
        form.setId("form-1");
        form.setTenantId("default");
        form.setFormKey(WorkflowEnablementDefaults.FORM_KEY);
        form.setFormName(WorkflowEnablementDefaults.FORM_NAME);
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
}
