package io.koravo.model.service;

import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.DeployProcessCommand;
import io.koravo.engine.dto.ProcessDeploymentDTO;
import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import io.koravo.common.model.AssetOrigin;
import io.koravo.form.domain.KoFormBinding;
import io.koravo.form.repo.FormBindingRepository;
import io.koravo.model.dto.ProcessModelCreateRequest;
import io.koravo.model.dto.ProcessModelDeployResponse;
import io.koravo.model.dto.ProcessModelExportResponse;
import io.koravo.model.dto.ProcessModelImportRequest;
import io.koravo.model.dto.ProcessModelResponse;
import io.koravo.model.dto.ProcessModelUpdateRequest;
import io.koravo.model.dto.BpmnTaskDefinitionResponse;
import io.koravo.model.domain.KoProcessModel;
import io.koravo.model.domain.ProcessModelStatus;
import io.koravo.model.repo.ProcessModelRepository;
import io.koravo.model.validation.BpmnValidationResult;
import io.koravo.model.validation.BpmnValidationService;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import java.io.IOException;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;

@Service
public class ProcessModelService {
    private static final String START_FORM_TASK_KEY = "__START__";
    private static final List<AssetOrigin> PRODUCTION_ASSET_ORIGINS = List.of(
            AssetOrigin.SYSTEM_TEMPLATE,
            AssetOrigin.USER_FLOW
    );

    private final ProcessFacade processFacade;
    private final ProcessModelRepository repository;
    private final FormBindingRepository formBindingRepository;
    private final AuditLogService auditLogService;
    private final BpmnValidationService validationService;

    public ProcessModelService(
            ProcessFacade processFacade,
            ProcessModelRepository repository,
            FormBindingRepository formBindingRepository,
            AuditLogService auditLogService,
            BpmnValidationService validationService
    ) {
        this.processFacade = processFacade;
        this.repository = repository;
        this.formBindingRepository = formBindingRepository;
        this.auditLogService = auditLogService;
        this.validationService = validationService;
    }

    @Transactional
    public ProcessModelResponse create(ProcessModelCreateRequest request) {
        String bpmnXml = StringUtils.hasText(request.bpmnXml())
                ? request.bpmnXml()
                : DefaultBpmnTemplates.approval(request.modelKey(), request.modelName());
        KoProcessModel model = createDraftModel(request.modelKey(), request.modelName(), request.description(), bpmnXml);
        auditLogService.record("PROCESS_MODEL_CREATE", "PROCESS_MODEL", model.getId(), modelAuditDetail(model));
        return toResponse(model);
    }

    @Transactional
    public ProcessModelResponse importModel(ProcessModelImportRequest request) {
        String modelKey = extractProcessId(request.bpmnXml());
        KoProcessModel model = createDraftModel(modelKey, request.modelName(), request.description(), request.bpmnXml());
        auditLogService.record("PROCESS_MODEL_IMPORT", "PROCESS_MODEL", model.getId(), modelAuditDetail(model));
        return toResponse(model);
    }

    @Transactional(readOnly = true)
    public List<ProcessModelResponse> list(ProcessModelStatus status) {
        return list(status, false);
    }

    @Transactional(readOnly = true)
    public List<ProcessModelResponse> list(ProcessModelStatus status, boolean includeNonProduction) {
        String tenantId = TenantContextHolder.getTenantId();
        List<KoProcessModel> models;
        if (includeNonProduction) {
            models = status == null
                    ? repository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(tenantId)
                    : repository.findByTenantIdAndStatusAndDeletedFalseOrderByUpdatedAtDesc(tenantId, status);
        } else {
            models = status == null
                    ? repository.findByTenantIdAndStatusNotAndAssetOriginInAndDeletedFalseOrderByUpdatedAtDesc(
                            tenantId,
                            ProcessModelStatus.ARCHIVED,
                            PRODUCTION_ASSET_ORIGINS
                    )
                    : repository.findByTenantIdAndStatusAndAssetOriginInAndDeletedFalseOrderByUpdatedAtDesc(tenantId, status, PRODUCTION_ASSET_ORIGINS);
        }
        return models.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ProcessModelResponse get(String id) {
        return toResponse(find(id));
    }

    @Transactional
    public ProcessModelResponse update(String id, ProcessModelUpdateRequest request) {
        KoProcessModel model = find(id);
        model.setModelName(request.modelName());
        model.setDescription(request.description());
        model.setBpmnXml(request.bpmnXml());
        model.setUpdatedBy(UserContextHolder.getUserId());
        if (model.getStatus() == ProcessModelStatus.DEPLOYED) {
            model.setVersion(model.getVersion() + 1);
            model.setStatus(ProcessModelStatus.DRAFT);
        }
        repository.save(model);
        auditLogService.record("PROCESS_MODEL_UPDATE", "PROCESS_MODEL", model.getId(), modelAuditDetail(model));
        return toResponse(model);
    }

    @Transactional(readOnly = true)
    public BpmnValidationResult validate(String id) {
        return validationService.validate(find(id).getBpmnXml());
    }

    @Transactional(readOnly = true)
    public BpmnValidationResult validateXml(String bpmnXml) {
        return validationService.validate(bpmnXml);
    }

    @Transactional
    public ProcessModelDeployResponse deploy(String id) {
        KoProcessModel model = find(id);
        if (model.getStatus() != ProcessModelStatus.DRAFT) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Only draft process models can be deployed");
        }
        BpmnValidationResult validation = validationService.validate(model.getBpmnXml());
        if (!validation.valid()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "BPMN model has validation errors");
        }
        assertReleaseReady(model);

        ProcessDeploymentDTO deployment = processFacade.deploy(new DeployProcessCommand(
                model.getTenantId(),
                UserContextHolder.getUserId(),
                model.getModelKey(),
                model.getModelName(),
                model.getModelKey() + ".bpmn20.xml",
                model.getBpmnXml()
        ));

        model.setFlowableDeploymentId(deployment.deploymentId());
        model.setFlowableDefinitionId(deployment.processDefinitionId());
        model.setModelKey(deployment.processDefinitionKey());
        model.setVersion(deployment.version());
        model.setStatus(ProcessModelStatus.DEPLOYED);
        model.setUpdatedBy(UserContextHolder.getUserId());
        repository.save(model);

        auditLogService.record("PROCESS_MODEL_DEPLOY", "PROCESS_MODEL", model.getId(), Map.of(
                "deploymentId", deployment.deploymentId(),
                "processDefinitionId", deployment.processDefinitionId(),
                "processDefinitionKey", deployment.processDefinitionKey()
        ));
        return new ProcessModelDeployResponse(toResponse(model), deployment.withPlatformModelId(model.getId()));
    }

    @Transactional
    public ProcessModelResponse disable(String id) {
        KoProcessModel model = find(id);
        model.setStatus(ProcessModelStatus.DISABLED);
        model.setUpdatedBy(UserContextHolder.getUserId());
        repository.save(model);
        auditLogService.record("PROCESS_MODEL_DISABLE", "PROCESS_MODEL", model.getId(), modelAuditDetail(model));
        return toResponse(model);
    }

    @Transactional
    public ProcessModelResponse archive(String id) {
        KoProcessModel model = find(id);
        model.setStatus(ProcessModelStatus.ARCHIVED);
        model.setUpdatedBy(UserContextHolder.getUserId());
        repository.save(model);
        auditLogService.record("PROCESS_MODEL_ARCHIVE", "PROCESS_MODEL", model.getId(), modelAuditDetail(model));
        return toResponse(model);
    }

    @Transactional
    public ProcessModelResponse updateAssetOrigin(String id, AssetOrigin assetOrigin) {
        KoProcessModel model = find(id);
        model.setAssetOrigin(assetOrigin);
        model.setUpdatedBy(UserContextHolder.getUserId());
        repository.save(model);
        auditLogService.record("PROCESS_MODEL_ASSET_ORIGIN_UPDATE", "PROCESS_MODEL", model.getId(), modelAuditDetail(model));
        return toResponse(model);
    }

    @Transactional
    public ProcessModelResponse restoreDraft(String id) {
        KoProcessModel source = find(id);
        KoProcessModel draft = new KoProcessModel();
        draft.setTenantId(source.getTenantId());
        draft.setCreatedBy(UserContextHolder.getUserId());
        draft.setUpdatedBy(UserContextHolder.getUserId());
        draft.setModelKey(source.getModelKey());
        draft.setModelName(source.getModelName());
        draft.setModelType(source.getModelType());
        draft.setVersion(nextVersion(source));
        draft.setStatus(ProcessModelStatus.DRAFT);
        draft.setDescription(source.getDescription());
        draft.setBpmnXml(source.getBpmnXml());
        draft.setAssetOrigin(source.getAssetOrigin());
        repository.save(draft);

        Map<String, Object> detail = modelAuditDetail(draft);
        detail.put("sourceModelId", source.getId());
        detail.put("sourceVersion", source.getVersion());
        auditLogService.record("PROCESS_MODEL_RESTORE_DRAFT", "PROCESS_MODEL", draft.getId(), detail);
        return toResponse(draft);
    }

    @Transactional
    public ProcessDeploymentDTO deploy(String modelName, MultipartFile file) {
        return deploy(modelName, file, AssetOrigin.USER_FLOW);
    }

    @Transactional
    public ProcessDeploymentDTO deploy(String modelName, MultipartFile file, AssetOrigin assetOrigin) {
        String fileName = file.getOriginalFilename() == null ? "process.bpmn20.xml" : file.getOriginalFilename();
        String modelKey = fileName.replace(".bpmn20.xml", "").replaceAll("[^A-Za-z0-9_]", "_");
        String bpmnXml = readFile(file);
        BpmnValidationResult validation = validationService.validate(bpmnXml);
        if (!validation.valid()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "BPMN model has validation errors");
        }

        ProcessDeploymentDTO deployment = processFacade.deploy(new DeployProcessCommand(
                TenantContextHolder.getTenantId(),
                UserContextHolder.getUserId(),
                modelKey,
                modelName == null || modelName.isBlank() ? modelKey : modelName,
                fileName,
                bpmnXml
        ));

        KoProcessModel model = new KoProcessModel();
        model.setTenantId(TenantContextHolder.getTenantId());
        model.setCreatedBy(UserContextHolder.getUserId());
        model.setUpdatedBy(UserContextHolder.getUserId());
        model.setModelKey(deployment.processDefinitionKey());
        model.setModelName(modelName == null || modelName.isBlank() ? deployment.processDefinitionKey() : modelName);
        model.setModelType("BPMN");
        model.setVersion(deployment.version());
        model.setFlowableDeploymentId(deployment.deploymentId());
        model.setFlowableDefinitionId(deployment.processDefinitionId());
        model.setStatus(ProcessModelStatus.DEPLOYED);
        model.setAssetOrigin(assetOrigin == null ? AssetOrigin.USER_FLOW : assetOrigin);
        model.setBpmnXml(bpmnXml);
        repository.save(model);

        auditLogService.record("PROCESS_MODEL_DEPLOY", "PROCESS_MODEL", model.getId(), Map.of(
                "deploymentId", deployment.deploymentId(),
                "processDefinitionId", deployment.processDefinitionId(),
                "processDefinitionKey", deployment.processDefinitionKey()
        ));
        return deployment.withPlatformModelId(model.getId());
    }

    @Transactional(readOnly = true)
    public ProcessModelExportResponse export(String id) {
        KoProcessModel model = find(id);
        return new ProcessModelExportResponse(exportFileName(model), model.getBpmnXml());
    }

    @Transactional(readOnly = true)
    public List<BpmnTaskDefinitionResponse> taskDefinitions(String id) {
        KoProcessModel model = find(id);
        return parseTaskDefinitions(model.getBpmnXml());
    }

    private void assertReleaseReady(KoProcessModel model) {
        List<KoFormBinding> bindings = formBindingRepository
                .findByTenantIdAndProcessModelIdAndDeletedFalseOrderByUpdatedAtDesc(
                        model.getTenantId(),
                        model.getId()
                );
        boolean hasStartBinding = bindings.stream()
                .anyMatch(binding -> START_FORM_TASK_KEY.equals(binding.getTaskDefinitionKey()));
        if (!hasStartBinding) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "发布检查未通过：缺少启动表单绑定");
        }

        List<String> boundTaskKeys = bindings.stream()
                .map(KoFormBinding::getTaskDefinitionKey)
                .filter(StringUtils::hasText)
                .filter(taskKey -> !START_FORM_TASK_KEY.equals(taskKey))
                .toList();
        List<String> missingTaskNames = parseTaskDefinitions(model.getBpmnXml())
                .stream()
                .filter(task -> !boundTaskKeys.contains(task.taskDefinitionKey()))
                .map(task -> StringUtils.hasText(task.name()) ? task.name() : task.taskDefinitionKey())
                .toList();
        if (!missingTaskNames.isEmpty()) {
            throw new BusinessException(
                    ErrorCode.BAD_REQUEST,
                    "发布检查未通过：缺少任务表单绑定 " + String.join("、", missingTaskNames)
            );
        }
    }

    private List<BpmnTaskDefinitionResponse> parseTaskDefinitions(String bpmnXml) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            NodeList tasks = factory.newDocumentBuilder()
                    .parse(new InputSource(new StringReader(bpmnXml)))
                    .getElementsByTagNameNS("*", "userTask");
            java.util.ArrayList<BpmnTaskDefinitionResponse> result = new java.util.ArrayList<>();
            for (int i = 0; i < tasks.getLength(); i++) {
                Element task = (Element) tasks.item(i);
                result.add(new BpmnTaskDefinitionResponse(
                        task.getAttribute("id"),
                        task.getAttribute("name"),
                        "UserTask",
                        readAttribute(task, "assignee")
                ));
            }
            return result;
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "无法解析 BPMN 任务节点");
        }
    }

    private String readFile(MultipartFile file) {
        try {
            return new String(file.getBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalArgumentException("Failed to read BPMN file", e);
        }
    }

    private KoProcessModel find(String id) {
        return repository.findByIdAndTenantIdAndDeletedFalse(id, TenantContextHolder.getTenantId())
                .orElseThrow(() -> new BusinessException(ErrorCode.MODEL_NOT_FOUND, "Process model not found"));
    }

    private KoProcessModel createDraftModel(String modelKey, String modelName, String description, String bpmnXml) {
        KoProcessModel model = new KoProcessModel();
        model.setTenantId(TenantContextHolder.getTenantId());
        model.setCreatedBy(UserContextHolder.getUserId());
        model.setUpdatedBy(UserContextHolder.getUserId());
        model.setModelKey(modelKey);
        model.setModelName(modelName);
        model.setModelType("BPMN");
        model.setVersion(1);
        model.setStatus(ProcessModelStatus.DRAFT);
        model.setDescription(description);
        model.setBpmnXml(bpmnXml);
        model.setAssetOrigin(AssetOrigin.USER_FLOW);
        repository.save(model);
        return model;
    }

    private int nextVersion(KoProcessModel model) {
        return repository
                .findByTenantIdAndModelKeyAndDeletedFalseOrderByVersionDescUpdatedAtDesc(
                        model.getTenantId(),
                        model.getModelKey()
                )
                .stream()
                .mapToInt(KoProcessModel::getVersion)
                .max()
                .orElse(model.getVersion()) + 1;
    }

    private ProcessModelResponse toResponse(KoProcessModel model) {
        return new ProcessModelResponse(
                model.getId(),
                model.getTenantId(),
                model.getModelKey(),
                model.getModelName(),
                model.getModelType(),
                model.getVersion(),
                model.getFlowableDeploymentId(),
                model.getFlowableDefinitionId(),
                model.getStatus().name(),
                model.getDescription(),
                model.getBpmnXml(),
                model.getAssetOrigin().name(),
                model.getCreatedAt(),
                model.getUpdatedAt()
        );
    }

    private String exportFileName(KoProcessModel model) {
        String modelKey = StringUtils.hasText(model.getModelKey()) ? model.getModelKey() : "process-model";
        return modelKey.replaceAll("[^A-Za-z0-9_-]", "_") + ".bpmn20.xml";
    }

    private Map<String, Object> modelAuditDetail(KoProcessModel model) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("modelKey", model.getModelKey());
        detail.put("version", model.getVersion());
        detail.put("status", model.getStatus().name());
        detail.put("assetOrigin", model.getAssetOrigin().name());
        if (StringUtils.hasText(model.getFlowableDeploymentId())) {
            detail.put("deploymentId", model.getFlowableDeploymentId());
        }
        if (StringUtils.hasText(model.getFlowableDefinitionId())) {
            detail.put("processDefinitionId", model.getFlowableDefinitionId());
        }
        return detail;
    }

    private String extractProcessId(String bpmnXml) {
        BpmnValidationResult validation = validationService.validate(bpmnXml);
        if (!validation.valid()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "BPMN model has validation errors");
        }
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            NodeList processes = factory.newDocumentBuilder()
                    .parse(new InputSource(new StringReader(bpmnXml)))
                    .getElementsByTagNameNS("*", "process");
            if (processes.getLength() == 0) {
                return "importedProcess";
            }
            String processId = ((Element) processes.item(0)).getAttribute("id");
            return StringUtils.hasText(processId) ? processId : "importedProcess";
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "BPMN model has validation errors");
        }
    }

    private String readAttribute(Element element, String name) {
        if (element.hasAttribute(name)) {
            return element.getAttribute(name);
        }
        if (element.hasAttribute("flowable:" + name)) {
            return element.getAttribute("flowable:" + name);
        }
        return element.getAttributeNS("http://flowable.org/bpmn", name);
    }
}
