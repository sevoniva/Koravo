package io.koravo.api.demo;

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
import io.koravo.common.api.PageResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DemoServiceTest {
    private final ProcessFacade processFacade = mock(ProcessFacade.class);
    private final ProcessModelRepository processModelRepository = mock(ProcessModelRepository.class);
    private final FormSchemaRepository formSchemaRepository = mock(FormSchemaRepository.class);
    private final FormBindingRepository formBindingRepository = mock(FormBindingRepository.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final AuditLogQueryService auditLogQueryService = mock(AuditLogQueryService.class);
    private final DemoService service = new DemoService(
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
    void initCreatesDeploysAndBindsDemoData() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        when(processModelRepository.findFirstByTenantIdAndModelKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                DemoDefaults.PROCESS_KEY
        )).thenReturn(Optional.empty());
        when(formSchemaRepository.findFirstByTenantIdAndFormKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                DemoDefaults.FORM_KEY
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
                DemoDefaults.PROCESS_KEY,
                DemoDefaults.PROCESS_NAME,
                DemoDefaults.PROCESS_KEY + ".bpmn20.xml",
                DemoDefaults.leaveApprovalBpmn()
        ))).thenReturn(new ProcessDeploymentDTO(null, "dep-1", "pd-1", DemoDefaults.PROCESS_KEY, 1));

        DemoInitResponse response = service.init();

        assertThat(response.initialized()).isTrue();
        assertThat(response.processModelId()).isEqualTo("model-1");
        assertThat(response.processDefinitionId()).isEqualTo("pd-1");
        assertThat(response.formSchemaId()).isEqualTo("form-1");
        assertThat(response.formBindingId()).isEqualTo("binding-1");
        assertThat(response.actions()).contains(
                "创建请假审批流程模型",
                "部署请假审批流程",
                "创建请假申请表",
                "绑定请假申请表到审批任务"
        );
        verify(auditLogService).record(eq("DEMO_INIT"), eq("DEMO"), eq("leave-approval"), any(Map.class));
    }

    @Test
    void initUpdatesExistingWrongBindingInsteadOfCreatingDuplicate() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoProcessModel model = deployedModel();
        KoFormSchema form = activeForm();
        KoFormBinding oldBinding = binding("binding-1", "old-form", 1);
        when(processModelRepository.findFirstByTenantIdAndModelKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                DemoDefaults.PROCESS_KEY
        )).thenReturn(Optional.of(model));
        when(formSchemaRepository.findFirstByTenantIdAndFormKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                DemoDefaults.FORM_KEY
        )).thenReturn(Optional.of(form));
        when(formBindingRepository.findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "pd-1",
                DemoDefaults.APPROVE_TASK_KEY
        )).thenReturn(Optional.of(oldBinding));
        when(formBindingRepository.findFirstByTenantIdAndProcessModelIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "model-1",
                DemoDefaults.APPROVE_TASK_KEY
        )).thenReturn(Optional.empty());
        when(formBindingRepository.save(any(KoFormBinding.class))).thenAnswer(invocation -> invocation.getArgument(0));

        DemoInitResponse response = service.init();

        assertThat(response.formBindingId()).isEqualTo("binding-1");
        assertThat(oldBinding.getFormSchemaId()).isEqualTo("form-1");
        assertThat(oldBinding.getFormSchemaVersion()).isEqualTo(2);
        assertThat(oldBinding.getUpdatedBy()).isEqualTo("admin");
        assertThat(response.actions()).contains("更新审批任务表单绑定");
        verify(formBindingRepository).save(oldBinding);
    }

    @Test
    void statusReturnsInitializedWhenDemoDataIsReady() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        KoProcessModel model = deployedModel();
        KoFormSchema form = activeForm();
        KoFormBinding binding = binding("binding-1", "form-1", 2);
        when(processModelRepository.findFirstByTenantIdAndModelKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                DemoDefaults.PROCESS_KEY
        )).thenReturn(Optional.of(model));
        when(formSchemaRepository.findFirstByTenantIdAndFormKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                DemoDefaults.FORM_KEY
        )).thenReturn(Optional.of(form));
        when(formBindingRepository.findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                "default",
                "pd-1",
                DemoDefaults.APPROVE_TASK_KEY
        )).thenReturn(Optional.of(binding));
        when(processFacade.queryMyTasks(any())).thenReturn(PageResult.of(java.util.List.of(), 0, 1, 1));
        when(auditLogQueryService.query(null, null, null, null, null, null, null, 1, 1))
                .thenReturn(PageResult.of(java.util.List.of(), 3, 1, 1));

        DemoStatusResponse response = service.status();

        assertThat(response.initialized()).isTrue();
        assertThat(response.tenantId()).isEqualTo("default");
        assertThat(response.userId()).isEqualTo("admin");
        assertThat(response.message()).isEqualTo("演示数据已就绪");
        assertThat(response.process().ready()).isTrue();
        assertThat(response.form().ready()).isTrue();
        assertThat(response.binding().ready()).isTrue();
        assertThat(response.audit().count()).isEqualTo(3);
        assertThat(response.defaultStartVariables()).containsEntry("approver", "admin");
        verify(processFacade, never()).deploy(any());
    }

    private KoProcessModel deployedModel() {
        KoProcessModel model = new KoProcessModel();
        model.setId("model-1");
        model.setTenantId("default");
        model.setModelKey(DemoDefaults.PROCESS_KEY);
        model.setModelName(DemoDefaults.PROCESS_NAME);
        model.setModelType("BPMN");
        model.setVersion(1);
        model.setStatus(ProcessModelStatus.DEPLOYED);
        model.setFlowableDeploymentId("dep-1");
        model.setFlowableDefinitionId("pd-1");
        model.setBpmnXml(DemoDefaults.leaveApprovalBpmn());
        return model;
    }

    private KoFormSchema activeForm() {
        KoFormSchema form = new KoFormSchema();
        form.setId("form-1");
        form.setTenantId("default");
        form.setFormKey(DemoDefaults.FORM_KEY);
        form.setFormName(DemoDefaults.FORM_NAME);
        form.setVersion(2);
        form.setSchemaJson(DemoDefaults.leaveFormSchema());
        form.setUiSchemaJson(DemoDefaults.leaveFormUiSchema());
        form.setStatus(FormStatus.ACTIVE);
        return form;
    }

    private KoFormBinding binding(String id, String formSchemaId, int version) {
        KoFormBinding binding = new KoFormBinding();
        binding.setId(id);
        binding.setTenantId("default");
        binding.setProcessModelId("model-1");
        binding.setProcessDefinitionId("pd-1");
        binding.setTaskDefinitionKey(DemoDefaults.APPROVE_TASK_KEY);
        binding.setFormSchemaId(formSchemaId);
        binding.setFormSchemaVersion(version);
        return binding;
    }
}
