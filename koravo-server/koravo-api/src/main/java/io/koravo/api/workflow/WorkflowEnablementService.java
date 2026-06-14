package io.koravo.api.workflow;

import io.koravo.common.model.AssetOrigin;
import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import io.koravo.common.workflow.RuntimeVisibilityPolicy;
import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.DeployProcessCommand;
import io.koravo.engine.command.TaskQueryCommand;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
public class WorkflowEnablementService {
    private static final List<String> LEGACY_PROCESS_KEYS = List.of("multiAcceptance", "purchaseApproval", "leaveApproval");
    private static final List<String> LEGACY_FORM_KEYS = List.of("acceptance-request-form", "purchase-request-form");
    private static final List<String> RETIRED_PROCESS_KEYS = List.of(
            "multiAcceptance",
            "purchaseApproval",
            "leaveApproval",
            "httpConnectorDemo",
            "designerDeployCheck"
    );
    private static final List<String> RETIRED_FORM_KEYS = List.of(
            "acceptance-request-form",
            "purchase-request-form",
            "leave-form"
    );
    private static final Set<String> RETIRED_PROCESS_KEY_SET = Set.copyOf(RETIRED_PROCESS_KEYS);

    private final ProcessFacade processFacade;
    private final ProcessModelRepository processModelRepository;
    private final FormSchemaRepository formSchemaRepository;
    private final FormBindingRepository formBindingRepository;
    private final FormSchemaService formSchemaService;
    private final AuditLogService auditLogService;
    private final AuditLogQueryService auditLogQueryService;

    public WorkflowEnablementService(
            ProcessFacade processFacade,
            ProcessModelRepository processModelRepository,
            FormSchemaRepository formSchemaRepository,
            FormBindingRepository formBindingRepository,
            FormSchemaService formSchemaService,
            AuditLogService auditLogService,
            AuditLogQueryService auditLogQueryService
    ) {
        this.processFacade = processFacade;
        this.processModelRepository = processModelRepository;
        this.formSchemaRepository = formSchemaRepository;
        this.formBindingRepository = formBindingRepository;
        this.formSchemaService = formSchemaService;
        this.auditLogService = auditLogService;
        this.auditLogQueryService = auditLogQueryService;
    }

    @Transactional(readOnly = true)
    public WorkflowEnablementStatusResponse status() {
        String tenantId = TenantContextHolder.getTenantId();
        KoProcessModel model = findDefaultProcessModel(tenantId);
        KoFormSchema form = findDefaultFormSchema(tenantId);
        KoFormBinding startBinding = findMatchingBinding(tenantId, model, form, WorkflowEnablementDefaults.START_FORM_TASK_KEY);
        KoFormBinding approvalBinding = findMatchingBinding(tenantId, model, form, WorkflowEnablementDefaults.BUSINESS_ACCEPTANCE_TASK_KEY);
        int bindingCount = (startBinding == null ? 0 : 1)
                + (approvalBinding == null ? 0 : 1);
        boolean initialized = model != null
                && model.getStatus() == ProcessModelStatus.DEPLOYED
                && StringUtils.hasText(model.getFlowableDefinitionId())
                && form != null
                && startBinding != null
                && approvalBinding != null;
        long todoCount = processFacade.queryMyTasks(new TaskQueryCommand(
                tenantId,
                UserContextHolder.getUserId(),
                null,
                1,
                1,
                null,
                null,
                null,
                null,
                Set.of(),
                RuntimeVisibilityPolicy.HIDDEN_BUSINESS_KEY_PATTERNS
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
                startBinding == null ? null : startBinding.getId(),
                initialized ? "流程配置已就绪" : "流程配置未就绪",
                new WorkflowEnablementStatusResponse.WorkflowEnablementStepStatus(
                        model != null && model.getStatus() == ProcessModelStatus.DEPLOYED && StringUtils.hasText(model.getFlowableDefinitionId()),
                        model == null ? "MISSING" : model.getStatus().name(),
                        model == null ? "未创建协同审批流程" : "协同审批流程已部署",
                        model == null ? null : model.getId(),
                        model == null ? 0 : 1
                ),
                new WorkflowEnablementStatusResponse.WorkflowEnablementStepStatus(
                        form != null,
                        form == null ? "MISSING" : form.getStatus().name(),
                        form == null ? "未创建业务申请表" : "业务申请表可用",
                        form == null ? null : form.getId(),
                        form == null ? 0 : 1
                ),
                new WorkflowEnablementStatusResponse.WorkflowEnablementStepStatus(
                        bindingCount == 2,
                        bindingCount == 2 ? "READY" : "MISSING",
                        bindingCount == 2 ? "发起表单和多人会签任务已绑定" : "发起表单或会签任务未绑定",
                        startBinding == null ? null : startBinding.getId(),
                        bindingCount
                ),
                new WorkflowEnablementStatusResponse.WorkflowEnablementStepStatus(
                        todoCount > 0,
                        todoCount > 0 ? "READY" : "EMPTY",
                        todoCount > 0 ? "当前用户有待办任务" : "暂无待办，请先发起业务申请",
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
                        "集成动作可在集成管理中配置并运行",
                        "connectorOperations",
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

        KoProcessModel model = findDefaultProcessModel(tenantId);
        if (model == null) {
            model = createProcessModel(tenantId, userId, actions);
        }
        ensureProcessModel(model, userId, actions);

        KoFormSchema form = findDefaultFormSchema(tenantId);
        if (form == null) {
            form = createFormSchema(tenantId, userId, actions);
        }
        ensureFormSchema(form, userId, actions);

        KoFormBinding startBinding = ensureBinding(tenantId, userId, model, form, WorkflowEnablementDefaults.START_FORM_TASK_KEY, "发起表单", actions);
        ensureBinding(tenantId, userId, model, form, WorkflowEnablementDefaults.BUSINESS_ACCEPTANCE_TASK_KEY, "多人会签", actions);
        archiveRetiredWorkflowAssets(tenantId, userId, model, form, actions);

        auditLogService.record("WORKFLOW_ENABLEMENT_INIT", "WORKFLOW_ENABLEMENT", "collaborative-approval", Map.of(
                "processModelId", model.getId(),
                "processDefinitionId", model.getFlowableDefinitionId() == null ? "" : model.getFlowableDefinitionId(),
                "formSchemaId", form.getId(),
                "formBindingId", startBinding.getId(),
                "actions", actions
        ));

        return new WorkflowEnablementInitResponse(
                true,
                model.getId(),
                model.getFlowableDefinitionId(),
                model.getModelKey(),
                form.getId(),
                startBinding.getId(),
                actions.isEmpty() ? List.of("流程配置已存在，未重复创建") : actions
        );
    }

    @Transactional(readOnly = true)
    public List<StartableWorkflowResponse> startableProcesses() {
        String tenantId = TenantContextHolder.getTenantId();
        List<KoFormBinding> bindings = formBindingRepository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(tenantId);
        List<KoFormSchema> schemas = formSchemaRepository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(tenantId);
        Map<String, KoFormSchema> schemaMap = schemas.stream()
                .filter(schema -> schema.getStatus() == FormStatus.ACTIVE)
                .collect(java.util.stream.Collectors.toMap(
                        KoFormSchema::getId,
                        schema -> schema,
                        (left, right) -> left
                ));
        return processModelRepository
                .findByTenantIdAndStatusAndDeletedFalseOrderByUpdatedAtDesc(tenantId, ProcessModelStatus.DEPLOYED)
                .stream()
                .filter(this::isUserStartableProcess)
                .map(model -> startableProcess(model, bindings, schemaMap))
                .filter(response -> response != null)
                .toList();
    }

    private KoProcessModel findDefaultProcessModel(String tenantId) {
        KoProcessModel current = processModelRepository
                .findFirstByTenantIdAndModelKeyAndDeletedFalseOrderByUpdatedAtDesc(tenantId, WorkflowEnablementDefaults.PROCESS_KEY)
                .orElse(null);
        if (current != null) {
            return current;
        }
        for (String legacyKey : LEGACY_PROCESS_KEYS) {
            KoProcessModel legacy = processModelRepository
                    .findFirstByTenantIdAndModelKeyAndDeletedFalseOrderByUpdatedAtDesc(tenantId, legacyKey)
                    .orElse(null);
            if (legacy != null) {
                return legacy;
            }
        }
        return null;
    }

    private KoFormSchema findDefaultFormSchema(String tenantId) {
        KoFormSchema current = formSchemaRepository
                .findFirstByTenantIdAndFormKeyAndDeletedFalseOrderByUpdatedAtDesc(tenantId, WorkflowEnablementDefaults.FORM_KEY)
                .orElse(null);
        if (current != null) {
            return current;
        }
        for (String legacyKey : LEGACY_FORM_KEYS) {
            KoFormSchema legacy = formSchemaRepository
                    .findFirstByTenantIdAndFormKeyAndDeletedFalseOrderByUpdatedAtDesc(tenantId, legacyKey)
                    .orElse(null);
            if (legacy != null) {
                return legacy;
            }
        }
        return null;
    }

    private boolean isUserStartableProcess(KoProcessModel model) {
        if (model == null || !StringUtils.hasText(model.getFlowableDefinitionId())) {
            return false;
        }
        if (RETIRED_PROCESS_KEY_SET.contains(model.getModelKey())) {
            return false;
        }
        if (model.getAssetOrigin() != AssetOrigin.SYSTEM_TEMPLATE
                && model.getAssetOrigin() != AssetOrigin.USER_FLOW) {
            return false;
        }
        if (model.getStatus() != ProcessModelStatus.DEPLOYED) {
            return false;
        }
        return true;
    }

    private StartableWorkflowResponse startableProcess(
            KoProcessModel model,
            List<KoFormBinding> bindings,
            Map<String, KoFormSchema> schemaMap
    ) {
        KoFormBinding startBinding = bindings.stream()
                .filter(binding -> WorkflowEnablementDefaults.START_FORM_TASK_KEY.equals(binding.getTaskDefinitionKey()))
                .filter(binding -> bindingTargetsModel(binding, model))
                .findFirst()
                .orElse(null);
        if (startBinding == null) {
            return null;
        }
        KoFormSchema schema = schemaMap.get(startBinding.getFormSchemaId());
        if (schema == null) {
            return null;
        }
        if (!hasReadyTaskBindings(model, bindings, schemaMap)) {
            return null;
        }
        return new StartableWorkflowResponse(
                model.getId(),
                model.getFlowableDefinitionId(),
                model.getModelKey(),
                model.getModelName(),
                model.getDescription(),
                model.getBpmnXml(),
                startBinding.getId(),
                startFormSchema(schema, startBinding)
        );
    }

    private boolean hasReadyTaskBindings(
            KoProcessModel model,
            List<KoFormBinding> bindings,
            Map<String, KoFormSchema> schemaMap
    ) {
        List<String> taskKeys = parseUserTaskKeys(model.getBpmnXml());
        if (taskKeys.isEmpty()) {
            return true;
        }
        return taskKeys.stream().allMatch(taskKey -> bindings.stream()
                .filter(binding -> taskKey.equals(binding.getTaskDefinitionKey()))
                .filter(binding -> bindingTargetsModel(binding, model))
                .anyMatch(binding -> schemaMap.containsKey(binding.getFormSchemaId())));
    }

    private boolean bindingTargetsModel(KoFormBinding binding, KoProcessModel model) {
        return model.getId().equals(binding.getProcessModelId())
                || model.getFlowableDefinitionId().equals(binding.getProcessDefinitionId());
    }

    private List<String> parseUserTaskKeys(String bpmnXml) {
        if (!StringUtils.hasText(bpmnXml)) {
            return List.of("__INVALID_BPMN__");
        }
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            NodeList tasks = factory.newDocumentBuilder()
                    .parse(new InputSource(new StringReader(bpmnXml)))
                    .getElementsByTagNameNS("*", "userTask");
            List<String> keys = new ArrayList<>();
            for (int i = 0; i < tasks.getLength(); i++) {
                Element task = (Element) tasks.item(i);
                String id = task.getAttribute("id");
                if (StringUtils.hasText(id)) {
                    keys.add(id);
                }
            }
            return keys;
        } catch (Exception e) {
            return List.of("__INVALID_BPMN__");
        }
    }

    private FormSchemaResponse startFormSchema(KoFormSchema schema, KoFormBinding startBinding) {
        try {
            return formSchemaService.get(schema.getId(), startBinding.getFormSchemaVersion());
        } catch (BusinessException ex) {
            if (ex.errorCode() != ErrorCode.FORM_SCHEMA_NOT_FOUND) {
                throw ex;
            }
            return formSchemaService.get(schema.getId());
        }
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
        model.setDescription("业务申请提交后，由多个审批人并行会签处理。");
        model.setBpmnXml(WorkflowEnablementDefaults.businessRequestBpmn());
        model.setAssetOrigin(AssetOrigin.SYSTEM_TEMPLATE);
        actions.add("创建协同审批流程模型");
        return processModelRepository.save(model);
    }

    private void ensureProcessModel(KoProcessModel model, String userId, List<String> actions) {
        boolean changed = false;
        boolean needsDefinitionMigration = needsDefaultProcessDefinitionMigration(model);
        if (needsDefinitionMigration) {
            model.setBpmnXml(WorkflowEnablementDefaults.businessRequestBpmn());
            actions.add("更新协同审批流程定义");
            changed = true;
        }
        if (!WorkflowEnablementDefaults.PROCESS_KEY.equals(model.getModelKey())) {
            model.setModelKey(WorkflowEnablementDefaults.PROCESS_KEY);
            actions.add("迁移协同审批流程标识");
            changed = true;
        }
        if (!WorkflowEnablementDefaults.PROCESS_NAME.equals(model.getModelName())) {
            model.setModelName(WorkflowEnablementDefaults.PROCESS_NAME);
            changed = true;
        }
        if (!"业务申请提交后，由多个审批人并行会签处理。".equals(model.getDescription())) {
            model.setDescription("业务申请提交后，由多个审批人并行会签处理。");
            changed = true;
        }
        if (model.getAssetOrigin() != AssetOrigin.SYSTEM_TEMPLATE) {
            model.setAssetOrigin(AssetOrigin.SYSTEM_TEMPLATE);
            changed = true;
        }
        if (needsDefinitionMigration
                || model.getStatus() != ProcessModelStatus.DEPLOYED
                || !StringUtils.hasText(model.getFlowableDefinitionId())) {
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
            actions.add("部署协同审批流程");
            changed = true;
        }
        if (changed) {
            model.setUpdatedBy(userId);
            processModelRepository.save(model);
        }
    }

    private boolean needsDefaultProcessDefinitionMigration(KoProcessModel model) {
        String bpmnXml = model.getBpmnXml();
        return !WorkflowEnablementDefaults.PROCESS_KEY.equals(model.getModelKey())
                || !StringUtils.hasText(bpmnXml)
                || !bpmnXml.contains(WorkflowEnablementDefaults.PROCESS_KEY)
                || !bpmnXml.contains(WorkflowEnablementDefaults.BUSINESS_ACCEPTANCE_TASK_KEY)
                || bpmnXml.contains("managerApprover")
                || bpmnXml.contains("financeApprover");
    }

    private KoFormSchema createFormSchema(String tenantId, String userId, List<String> actions) {
        KoFormSchema form = new KoFormSchema();
        form.setTenantId(tenantId);
        form.setCreatedBy(userId);
        form.setUpdatedBy(userId);
        form.setFormKey(WorkflowEnablementDefaults.FORM_KEY);
        form.setFormName(WorkflowEnablementDefaults.FORM_NAME);
        form.setVersion(1);
        form.setSchemaJson(WorkflowEnablementDefaults.businessRequestFormSchema());
        form.setUiSchemaJson(WorkflowEnablementDefaults.businessRequestFormUiSchema());
        form.setStatus(FormStatus.ACTIVE);
        form.setAssetOrigin(AssetOrigin.SYSTEM_TEMPLATE);
        actions.add("创建业务申请表");
        return formSchemaRepository.save(form);
    }

    private void ensureFormSchema(KoFormSchema form, String userId, List<String> actions) {
        boolean changed = false;
        if (!WorkflowEnablementDefaults.FORM_KEY.equals(form.getFormKey())) {
            form.setFormKey(WorkflowEnablementDefaults.FORM_KEY);
            actions.add("迁移业务申请表标识");
            changed = true;
        }
        if (!WorkflowEnablementDefaults.FORM_NAME.equals(form.getFormName())) {
            form.setFormName(WorkflowEnablementDefaults.FORM_NAME);
            changed = true;
        }
        if (needsDefaultFormSchemaMigration(form)) {
            form.setSchemaJson(WorkflowEnablementDefaults.businessRequestFormSchema());
            form.setUiSchemaJson(WorkflowEnablementDefaults.businessRequestFormUiSchema());
            form.setVersion(Math.max(1, form.getVersion() + 1));
            actions.add("更新业务申请表为多人会签");
            changed = true;
        }
        if (!StringUtils.hasText(form.getUiSchemaJson()) || !form.getUiSchemaJson().contains("organizationProfile")) {
            form.setUiSchemaJson(WorkflowEnablementDefaults.businessRequestFormUiSchema());
            form.setVersion(Math.max(1, form.getVersion() + 1));
            actions.add("更新业务申请表组织字段");
            changed = true;
        }
        if (form.getStatus() != FormStatus.ACTIVE) {
            form.setStatus(FormStatus.ACTIVE);
            changed = true;
        }
        if (form.getAssetOrigin() != AssetOrigin.SYSTEM_TEMPLATE) {
            form.setAssetOrigin(AssetOrigin.SYSTEM_TEMPLATE);
            changed = true;
        }
        if (changed) {
            form.setUpdatedBy(userId);
            formSchemaRepository.save(form);
        }
    }

    private boolean needsDefaultFormSchemaMigration(KoFormSchema form) {
        String schemaJson = form.getSchemaJson();
        String uiSchemaJson = form.getUiSchemaJson();
        return !StringUtils.hasText(schemaJson)
                || !schemaJson.contains("事项内容")
                || !schemaJson.contains("\"approvalUsers\"")
                || schemaJson.contains("\"managerApprover\"")
                || schemaJson.contains("\"financeApprover\"")
                || schemaJson.contains("\"approved\"")
                || schemaJson.contains("\"reviewComment\"")
                || !StringUtils.hasText(uiSchemaJson)
                || !uiSchemaJson.contains("\"approvalUsers\"")
                || !uiSchemaJson.contains("\"permission\": \"readonly\"")
                || uiSchemaJson.contains("\"managerApprover\"")
                || uiSchemaJson.contains("\"financeApprover\"");
    }

    private KoFormBinding ensureBinding(
            String tenantId,
            String userId,
            KoProcessModel model,
            KoFormSchema form,
            String taskDefinitionKey,
            String taskName,
            List<String> actions
    ) {
        KoFormBinding binding = findMatchingBinding(tenantId, model, form, taskDefinitionKey);
        if (binding != null) {
            if (binding.getFormSchemaVersion() != form.getVersion()
                    || !Objects.equals(model.getId(), binding.getProcessModelId())
                    || !Objects.equals(model.getFlowableDefinitionId(), binding.getProcessDefinitionId())) {
                updateBinding(binding, userId, model, form, taskDefinitionKey, actions);
            }
            return binding;
        }
        binding = findReusableBinding(tenantId, model, taskDefinitionKey);
        if (binding == null) {
            return createBinding(tenantId, userId, model, form, taskDefinitionKey, taskName, actions);
        }
        updateBinding(binding, userId, model, form, taskDefinitionKey, actions);
        return binding;
    }

    private KoFormBinding findMatchingBinding(String tenantId, KoProcessModel model, KoFormSchema form, String taskDefinitionKey) {
        if (model == null || form == null) {
            return null;
        }
        if (StringUtils.hasText(model.getFlowableDefinitionId())) {
            KoFormBinding binding = formBindingRepository
                    .findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                            tenantId,
                            model.getFlowableDefinitionId(),
                            taskDefinitionKey
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
                        taskDefinitionKey
                )
                .filter(binding -> form.getId().equals(binding.getFormSchemaId()))
                .orElse(null);
    }

    private KoFormBinding findReusableBinding(String tenantId, KoProcessModel model, String taskDefinitionKey) {
        if (model == null) {
            return null;
        }
        if (StringUtils.hasText(model.getFlowableDefinitionId())) {
            KoFormBinding binding = formBindingRepository
                    .findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                            tenantId,
                            model.getFlowableDefinitionId(),
                            taskDefinitionKey
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
                        taskDefinitionKey
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
        actions.add(WorkflowEnablementDefaults.START_FORM_TASK_KEY.equals(taskDefinitionKey)
                ? "绑定发起表单"
                : "绑定业务申请表到" + taskName);
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
        actions.add(WorkflowEnablementDefaults.START_FORM_TASK_KEY.equals(taskDefinitionKey)
                ? "更新发起表单绑定"
                : "更新审批任务表单绑定");
    }

    private void archiveRetiredWorkflowAssets(
            String tenantId,
            String userId,
            KoProcessModel currentModel,
            KoFormSchema currentForm,
            List<String> actions
    ) {
        for (KoProcessModel model : processModelRepository.findByTenantIdAndModelKeyInAndDeletedFalseOrderByUpdatedAtDesc(tenantId, RETIRED_PROCESS_KEYS)) {
            if (currentModel != null && currentModel.getId().equals(model.getId())) {
                continue;
            }
            boolean changed = false;
            if (model.getStatus() != ProcessModelStatus.ARCHIVED) {
                model.setStatus(ProcessModelStatus.ARCHIVED);
                actions.add("归档历史流程资产：" + model.getModelName());
                changed = true;
            }
            if (model.getAssetOrigin() != AssetOrigin.LEGACY_DEMO) {
                model.setAssetOrigin(AssetOrigin.LEGACY_DEMO);
                changed = true;
            }
            if (changed) {
                model.setUpdatedBy(userId);
                processModelRepository.save(model);
            }
        }
        for (KoFormSchema form : formSchemaRepository.findByTenantIdAndFormKeyInAndDeletedFalseOrderByUpdatedAtDesc(tenantId, RETIRED_FORM_KEYS)) {
            if (currentForm != null && currentForm.getId().equals(form.getId())) {
                continue;
            }
            boolean changed = false;
            if (form.getStatus() != FormStatus.DISABLED) {
                form.setStatus(FormStatus.DISABLED);
                actions.add("停用历史表单资产：" + form.getFormName());
                changed = true;
            }
            if (form.getAssetOrigin() != AssetOrigin.LEGACY_DEMO) {
                form.setAssetOrigin(AssetOrigin.LEGACY_DEMO);
                changed = true;
            }
            if (changed) {
                form.setUpdatedBy(userId);
                formSchemaRepository.save(form);
            }
        }
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
        variables.put("subject", "业务事项申请");
        variables.put("businessDescription", "");
        variables.put("expectedResult", "");
        variables.put("approvalUsers", List.of("manager", "finance"));
        variables.put("remark", "");
        return variables;
    }

}
