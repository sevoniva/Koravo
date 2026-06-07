package io.koravo.model.service;

import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.DeployProcessCommand;
import io.koravo.engine.dto.ProcessDeploymentDTO;
import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import io.koravo.model.dto.ProcessModelCreateRequest;
import io.koravo.model.dto.ProcessModelDeployResponse;
import io.koravo.model.dto.ProcessModelImportRequest;
import io.koravo.model.dto.ProcessModelResponse;
import io.koravo.model.dto.ProcessModelUpdateRequest;
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

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Service
public class ProcessModelService {
    private final ProcessFacade processFacade;
    private final ProcessModelRepository repository;
    private final AuditLogService auditLogService;
    private final BpmnValidationService validationService;

    public ProcessModelService(
            ProcessFacade processFacade,
            ProcessModelRepository repository,
            AuditLogService auditLogService,
            BpmnValidationService validationService
    ) {
        this.processFacade = processFacade;
        this.repository = repository;
        this.auditLogService = auditLogService;
        this.validationService = validationService;
    }

    @Transactional
    public ProcessModelResponse create(ProcessModelCreateRequest request) {
        String bpmnXml = StringUtils.hasText(request.bpmnXml())
                ? request.bpmnXml()
                : DefaultBpmnTemplates.approval(request.modelKey(), request.modelName());
        KoProcessModel model = new KoProcessModel();
        model.setTenantId(TenantContextHolder.getTenantId());
        model.setCreatedBy(UserContextHolder.getUserId());
        model.setUpdatedBy(UserContextHolder.getUserId());
        model.setModelKey(request.modelKey());
        model.setModelName(request.modelName());
        model.setModelType("BPMN");
        model.setVersion(1);
        model.setStatus(ProcessModelStatus.DRAFT);
        model.setDescription(request.description());
        model.setBpmnXml(bpmnXml);
        repository.save(model);
        auditLogService.record("PROCESS_MODEL_CREATE", "PROCESS_MODEL", model.getId(), Map.of("modelKey", model.getModelKey()));
        return toResponse(model);
    }

    @Transactional
    public ProcessModelResponse importModel(ProcessModelImportRequest request) {
        String modelKey = extractProcessId(request.bpmnXml());
        return create(new ProcessModelCreateRequest(modelKey, request.modelName(), request.description(), request.bpmnXml()));
    }

    @Transactional(readOnly = true)
    public List<ProcessModelResponse> list(ProcessModelStatus status) {
        List<KoProcessModel> models = status == null
                ? repository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(TenantContextHolder.getTenantId())
                : repository.findByTenantIdAndStatusAndDeletedFalseOrderByUpdatedAtDesc(TenantContextHolder.getTenantId(), status);
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
        auditLogService.record("PROCESS_MODEL_UPDATE", "PROCESS_MODEL", model.getId(), Map.of("version", model.getVersion()));
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
        BpmnValidationResult validation = validationService.validate(model.getBpmnXml());
        if (!validation.valid()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "BPMN model has validation errors");
        }

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
        auditLogService.record("PROCESS_MODEL_DISABLE", "PROCESS_MODEL", model.getId(), Map.of("modelKey", model.getModelKey()));
        return toResponse(model);
    }

    @Transactional
    public ProcessModelResponse archive(String id) {
        KoProcessModel model = find(id);
        model.setStatus(ProcessModelStatus.ARCHIVED);
        model.setUpdatedBy(UserContextHolder.getUserId());
        repository.save(model);
        auditLogService.record("PROCESS_MODEL_ARCHIVE", "PROCESS_MODEL", model.getId(), Map.of("modelKey", model.getModelKey()));
        return toResponse(model);
    }

    @Transactional
    public ProcessDeploymentDTO deploy(String modelName, MultipartFile file) {
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
    public String exportBpmnXml(String id) {
        return find(id).getBpmnXml();
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
                model.getCreatedAt(),
                model.getUpdatedAt()
        );
    }

    private String extractProcessId(String bpmnXml) {
        BpmnValidationResult validation = validationService.validate(bpmnXml);
        if (!validation.valid()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "BPMN model has validation errors");
        }
        int processIndex = bpmnXml.indexOf("<process");
        if (processIndex < 0) {
            return "importedProcess";
        }
        int idIndex = bpmnXml.indexOf("id=\"", processIndex);
        if (idIndex < 0) {
            return "importedProcess";
        }
        int start = idIndex + 4;
        int end = bpmnXml.indexOf('"', start);
        return end > start ? bpmnXml.substring(start, end) : "importedProcess";
    }
}
