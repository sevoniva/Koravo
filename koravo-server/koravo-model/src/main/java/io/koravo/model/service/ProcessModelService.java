package io.koravo.model.service;

import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.DeployProcessCommand;
import io.koravo.engine.dto.ProcessDeploymentDTO;
import io.koravo.model.domain.KoProcessModel;
import io.koravo.model.domain.ProcessModelStatus;
import io.koravo.model.repo.ProcessModelRepository;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Service
public class ProcessModelService {
    private final ProcessFacade processFacade;
    private final ProcessModelRepository repository;
    private final AuditLogService auditLogService;

    public ProcessModelService(ProcessFacade processFacade, ProcessModelRepository repository, AuditLogService auditLogService) {
        this.processFacade = processFacade;
        this.repository = repository;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public ProcessDeploymentDTO deploy(String modelName, MultipartFile file) {
        String fileName = file.getOriginalFilename() == null ? "process.bpmn20.xml" : file.getOriginalFilename();
        String modelKey = fileName.replace(".bpmn20.xml", "").replaceAll("[^A-Za-z0-9_]", "_");
        String bpmnXml = readFile(file);

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
        repository.save(model);

        auditLogService.record("PROCESS_DEPLOY", "PROCESS_MODEL", model.getId(), Map.of(
                "deploymentId", deployment.deploymentId(),
                "processDefinitionId", deployment.processDefinitionId(),
                "processDefinitionKey", deployment.processDefinitionKey()
        ));
        return deployment.withPlatformModelId(model.getId());
    }

    private String readFile(MultipartFile file) {
        try {
            return new String(file.getBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalArgumentException("Failed to read BPMN file", e);
        }
    }
}
