package io.koravo.api.workflow;

import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.DeployProcessCommand;
import io.koravo.engine.command.TaskQueryCommand;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class WorkflowEnablementService {
    private final ProcessFacade processFacade;
    private final ProcessModelRepository processModelRepository;
    private final FormSchemaRepository formSchemaRepository;
    private final FormBindingRepository formBindingRepository;
    private final AuditLogService auditLogService;
    private final AuditLogQueryService auditLogQueryService;

    public WorkflowEnablementService(
            ProcessFacade processFacade,
            ProcessModelRepository processModelRepository,
            FormSchemaRepository formSchemaRepository,
            FormBindingRepository formBindingRepository,
            AuditLogService auditLogService,
            AuditLogQueryService auditLogQueryService
    ) {
        this.processFacade = processFacade;
        this.processModelRepository = processModelRepository;
        this.formSchemaRepository = formSchemaRepository;
        this.formBindingRepository = formBindingRepository;
        this.auditLogService = auditLogService;
        this.auditLogQueryService = auditLogQueryService;
    }

    @Transactional(readOnly = true)
    public WorkflowEnablementStatusResponse status() {
        String tenantId = TenantContextHolder.getTenantId();
        KoProcessModel model = processModelRepository
                .findFirstByTenantIdAndModelKeyAndDeletedFalseOrderByUpdatedAtDesc(tenantId, WorkflowEnablementDefaults.PROCESS_KEY)
                .orElse(null);
        KoFormSchema form = formSchemaRepository
                .findFirstByTenantIdAndFormKeyAndDeletedFalseOrderByUpdatedAtDesc(tenantId, WorkflowEnablementDefaults.FORM_KEY)
                .orElse(null);
        KoFormBinding binding = findMatchingBinding(tenantId, model, form);
        boolean initialized = model != null
                && model.getStatus() == ProcessModelStatus.DEPLOYED
                && StringUtils.hasText(model.getFlowableDefinitionId())
                && form != null
                && binding != null;
        long todoCount = processFacade.queryMyTasks(new TaskQueryCommand(
                tenantId,
                UserContextHolder.getUserId(),
                1,
                1,
                null,
                null,
                null,
                null
        )).total();
        long auditCount = auditLogQueryService.query(null, null, null, null, null, null, null, 1, 1).total();
        return new WorkflowEnablementStatusResponse(
                initialized,
                tenantId,
                UserContextHolder.getUserId(),
                model == null ? null : model.getId(),
                model == null ? null : model.getFlowableDefinitionId(),
                model == null ? WorkflowEnablementDefaults.PROCESS_KEY : model.getModelKey(),
                form == null ? null : form.getId(),
                binding == null ? null : binding.getId(),
                initialized ? "流程配置已就绪" : "流程配置未初始化",
                new WorkflowEnablementStatusResponse.WorkflowEnablementStepStatus(
                        model != null && model.getStatus() == ProcessModelStatus.DEPLOYED && StringUtils.hasText(model.getFlowableDefinitionId()),
                        model == null ? "MISSING" : model.getStatus().name(),
                        model == null ? "未创建采购申请流程" : "采购申请流程已部署",
                        model == null ? null : model.getId(),
                        model == null ? 0 : 1
                ),
                new WorkflowEnablementStatusResponse.WorkflowEnablementStepStatus(
                        form != null,
                        form == null ? "MISSING" : form.getStatus().name(),
                        form == null ? "未创建采购申请单" : "采购申请单可用",
                        form == null ? null : form.getId(),
                        form == null ? 0 : 1
                ),
                new WorkflowEnablementStatusResponse.WorkflowEnablementStepStatus(
                        binding != null,
                        binding == null ? "MISSING" : "READY",
                        binding == null ? "审批任务未绑定表单" : "并行审批任务已绑定表单",
                        binding == null ? null : binding.getId(),
                        binding == null ? 0 : 1
                ),
                new WorkflowEnablementStatusResponse.WorkflowEnablementStepStatus(
                        todoCount > 0,
                        todoCount > 0 ? "READY" : "EMPTY",
                        todoCount > 0 ? "当前用户有待办任务" : "暂无待办，请先发起采购申请",
                        null,
                        todoCount
                ),
                new WorkflowEnablementStatusResponse.WorkflowEnablementStepStatus(
                        auditCount > 0,
                        auditCount > 0 ? "READY" : "EMPTY",
                        auditCount > 0 ? "已有审计记录" : "暂无审计记录",
                        null,
                        auditCount
                ),
                new WorkflowEnablementStatusResponse.WorkflowEnablementStepStatus(
                        true,
                        "READY",
                        "HTTP 连接器流程可在 HTTP 连接器页运行",
                        "httpHealthCheck",
                        0
                ),
                defaultStartVariables()
        );
    }

    @Transactional
    public WorkflowEnablementInitResponse init() {
        String tenantId = TenantContextHolder.getTenantId();
        String userId = UserContextHolder.getUserId();
        List<String> actions = new ArrayList<>();

        KoProcessModel model = processModelRepository
                .findFirstByTenantIdAndModelKeyAndDeletedFalseOrderByUpdatedAtDesc(tenantId, WorkflowEnablementDefaults.PROCESS_KEY)
                .orElseGet(() -> createProcessModel(tenantId, userId, actions));
        ensureProcessModel(model, userId, actions);

        KoFormSchema form = formSchemaRepository
                .findFirstByTenantIdAndFormKeyAndDeletedFalseOrderByUpdatedAtDesc(tenantId, WorkflowEnablementDefaults.FORM_KEY)
                .orElseGet(() -> createFormSchema(tenantId, userId, actions));
        ensureFormSchema(form, userId, actions);

        KoFormBinding binding = findMatchingBinding(tenantId, model, form);
        if (binding == null) {
            binding = findReusableBinding(tenantId, model);
            if (binding == null) {
                binding = createBinding(tenantId, userId, model, form, WorkflowEnablementDefaults.MANAGER_APPROVE_TASK_KEY, "部门审批", actions);
            } else {
                updateBinding(binding, userId, model, form, WorkflowEnablementDefaults.MANAGER_APPROVE_TASK_KEY, actions);
            }
        }
        ensureTaskBinding(tenantId, userId, model, form, WorkflowEnablementDefaults.FINANCE_APPROVE_TASK_KEY, "财务审批", actions);

        auditLogService.record("WORKFLOW_ENABLEMENT_INIT", "WORKFLOW_ENABLEMENT", "purchase-approval", Map.of(
                "processModelId", model.getId(),
                "processDefinitionId", model.getFlowableDefinitionId() == null ? "" : model.getFlowableDefinitionId(),
                "formSchemaId", form.getId(),
                "formBindingId", binding.getId(),
                "actions", actions
        ));

        return new WorkflowEnablementInitResponse(
                true,
                model.getId(),
                model.getFlowableDefinitionId(),
                model.getModelKey(),
                form.getId(),
                binding.getId(),
                actions.isEmpty() ? List.of("流程配置已存在，未重复创建") : actions
        );
    }

    private KoProcessModel createProcessModel(String tenantId, String userId, List<String> actions) {
        KoProcessModel model = new KoProcessModel();
        model.setTenantId(tenantId);
        model.setCreatedBy(userId);
        model.setUpdatedBy(userId);
        model.setModelKey(WorkflowEnablementDefaults.PROCESS_KEY);
        model.setModelName(WorkflowEnablementDefaults.PROCESS_NAME);
        model.setModelType("BPMN");
        model.setVersion(1);
        model.setStatus(ProcessModelStatus.DRAFT);
        model.setDescription("采购申请提交后，部门审批和财务审批并行处理。");
        model.setBpmnXml(WorkflowEnablementDefaults.purchaseApprovalBpmn());
        actions.add("创建采购申请流程模型");
        return processModelRepository.save(model);
    }

    private void ensureProcessModel(KoProcessModel model, String userId, List<String> actions) {
        boolean changed = false;
        if (!StringUtils.hasText(model.getBpmnXml())) {
            model.setBpmnXml(WorkflowEnablementDefaults.purchaseApprovalBpmn());
            changed = true;
        }
        if (!WorkflowEnablementDefaults.PROCESS_NAME.equals(model.getModelName())) {
            model.setModelName(WorkflowEnablementDefaults.PROCESS_NAME);
            changed = true;
        }
        if (model.getStatus() != ProcessModelStatus.DEPLOYED || !StringUtils.hasText(model.getFlowableDefinitionId())) {
            ProcessDeploymentDTO deployment = processFacade.deploy(new DeployProcessCommand(
                    model.getTenantId(),
                    userId,
                    WorkflowEnablementDefaults.PROCESS_KEY,
                    WorkflowEnablementDefaults.PROCESS_NAME,
                    WorkflowEnablementDefaults.PROCESS_KEY + ".bpmn20.xml",
                    model.getBpmnXml()
            ));
            model.setFlowableDeploymentId(deployment.deploymentId());
            model.setFlowableDefinitionId(deployment.processDefinitionId());
            model.setModelKey(deployment.processDefinitionKey());
            model.setVersion(deployment.version());
            model.setStatus(ProcessModelStatus.DEPLOYED);
            actions.add("部署采购申请流程");
            changed = true;
        }
        if (changed) {
            model.setUpdatedBy(userId);
            processModelRepository.save(model);
        }
    }

    private KoFormSchema createFormSchema(String tenantId, String userId, List<String> actions) {
        KoFormSchema form = new KoFormSchema();
        form.setTenantId(tenantId);
        form.setCreatedBy(userId);
        form.setUpdatedBy(userId);
        form.setFormKey(WorkflowEnablementDefaults.FORM_KEY);
        form.setFormName(WorkflowEnablementDefaults.FORM_NAME);
        form.setVersion(1);
        form.setSchemaJson(WorkflowEnablementDefaults.purchaseFormSchema());
        form.setUiSchemaJson(WorkflowEnablementDefaults.purchaseFormUiSchema());
        form.setStatus(FormStatus.ACTIVE);
        actions.add("创建采购申请单");
        return formSchemaRepository.save(form);
    }

    private void ensureFormSchema(KoFormSchema form, String userId, List<String> actions) {
        boolean changed = false;
        if (!WorkflowEnablementDefaults.FORM_NAME.equals(form.getFormName())) {
            form.setFormName(WorkflowEnablementDefaults.FORM_NAME);
            changed = true;
        }
        if (!StringUtils.hasText(form.getSchemaJson()) || !form.getSchemaJson().contains("采购原因")) {
            form.setSchemaJson(WorkflowEnablementDefaults.purchaseFormSchema());
            form.setUiSchemaJson(WorkflowEnablementDefaults.purchaseFormUiSchema());
            form.setVersion(Math.max(1, form.getVersion() + 1));
            actions.add("更新采购申请单");
            changed = true;
        }
        if (form.getStatus() != FormStatus.ACTIVE) {
            form.setStatus(FormStatus.ACTIVE);
            changed = true;
        }
        if (changed) {
            form.setUpdatedBy(userId);
            formSchemaRepository.save(form);
        }
    }

    private KoFormBinding findMatchingBinding(String tenantId, KoProcessModel model, KoFormSchema form) {
        if (model == null || form == null) {
            return null;
        }
        if (StringUtils.hasText(model.getFlowableDefinitionId())) {
            KoFormBinding binding = formBindingRepository
                    .findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                            tenantId,
                            model.getFlowableDefinitionId(),
                            WorkflowEnablementDefaults.APPROVE_TASK_KEY
                    )
                    .orElse(null);
            if (binding != null && form.getId().equals(binding.getFormSchemaId())) {
                return binding;
            }
        }
        return formBindingRepository
                .findFirstByTenantIdAndProcessModelIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                        tenantId,
                        model.getId(),
                        WorkflowEnablementDefaults.APPROVE_TASK_KEY
                )
                .filter(binding -> form.getId().equals(binding.getFormSchemaId()))
                .orElse(null);
    }

    private KoFormBinding findReusableBinding(String tenantId, KoProcessModel model) {
        if (model == null) {
            return null;
        }
        if (StringUtils.hasText(model.getFlowableDefinitionId())) {
            KoFormBinding binding = formBindingRepository
                    .findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                            tenantId,
                            model.getFlowableDefinitionId(),
                            WorkflowEnablementDefaults.APPROVE_TASK_KEY
                    )
                    .orElse(null);
            if (binding != null) {
                return binding;
            }
        }
        return formBindingRepository
                .findFirstByTenantIdAndProcessModelIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                        tenantId,
                        model.getId(),
                        WorkflowEnablementDefaults.APPROVE_TASK_KEY
                )
                .orElse(null);
    }

    private KoFormBinding createBinding(
            String tenantId,
            String userId,
            KoProcessModel model,
            KoFormSchema form,
            String taskDefinitionKey,
            String taskName,
            List<String> actions
    ) {
        KoFormBinding binding = new KoFormBinding();
        binding.setTenantId(tenantId);
        binding.setCreatedBy(userId);
        binding.setUpdatedBy(userId);
        binding.setProcessModelId(model.getId());
        binding.setProcessDefinitionId(model.getFlowableDefinitionId());
        binding.setTaskDefinitionKey(taskDefinitionKey);
        binding.setFormSchemaId(form.getId());
        binding.setFormSchemaVersion(form.getVersion());
        actions.add("绑定采购申请单到" + taskName);
        return formBindingRepository.save(binding);
    }

    private void updateBinding(
            KoFormBinding binding,
            String userId,
            KoProcessModel model,
            KoFormSchema form,
            String taskDefinitionKey,
            List<String> actions
    ) {
        binding.setUpdatedBy(userId);
        binding.setProcessModelId(model.getId());
        binding.setProcessDefinitionId(model.getFlowableDefinitionId());
        binding.setTaskDefinitionKey(taskDefinitionKey);
        binding.setFormSchemaId(form.getId());
        binding.setFormSchemaVersion(form.getVersion());
        formBindingRepository.save(binding);
        actions.add("更新审批任务表单绑定");
    }

    private void ensureTaskBinding(
            String tenantId,
            String userId,
            KoProcessModel model,
            KoFormSchema form,
            String taskDefinitionKey,
            String taskName,
            List<String> actions
    ) {
        KoFormBinding binding = null;
        if (StringUtils.hasText(model.getFlowableDefinitionId())) {
            binding = formBindingRepository
                    .findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                            tenantId,
                            model.getFlowableDefinitionId(),
                            taskDefinitionKey
                    )
                    .orElse(null);
        }
        if (binding == null) {
            binding = formBindingRepository
                    .findFirstByTenantIdAndProcessModelIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                            tenantId,
                            model.getId(),
                            taskDefinitionKey
                    )
                    .orElse(null);
        }
        if (binding == null) {
            createBinding(tenantId, userId, model, form, taskDefinitionKey, taskName, actions);
        } else if (!form.getId().equals(binding.getFormSchemaId()) || binding.getFormSchemaVersion() != form.getVersion()) {
            updateBinding(binding, userId, model, form, taskDefinitionKey, actions);
        }
    }

    public Map<String, Object> defaultStartVariables() {
        Map<String, Object> variables = new LinkedHashMap<>();
        variables.put("applicant", "张三");
        variables.put("department", "研发部");
        variables.put("itemName", "测试环境服务器");
        variables.put("amount", 12000);
        variables.put("reason", "用于流程集成测试和性能验证");
        variables.put("managerApprover", WorkflowEnablementDefaults.USER_ID);
        variables.put("financeApprover", WorkflowEnablementDefaults.USER_ID);
        variables.put("remark", "");
        return variables;
    }
}
