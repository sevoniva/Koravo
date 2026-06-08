package io.koravo.api.service;

import io.koravo.api.web.StartProcessRequest;
import io.koravo.api.web.ProcessInstanceDetailResponse;
import io.koravo.common.web.RequestContextHolder;
import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.StartProcessCommand;
import io.koravo.engine.dto.ProcessInstanceDTO;
import io.koravo.engine.dto.ProcessInstanceDetailDTO;
import io.koravo.form.service.FormSchemaService;
import io.koravo.form.service.FormSnapshotService;
import io.koravo.form.web.FormSchemaResponse;
import io.koravo.ops.audit.AuditLogQueryService;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class ProcessInstanceAppService {
    private final ProcessFacade processFacade;
    private final AuditLogService auditLogService;
    private final AuditLogQueryService auditLogQueryService;
    private final FormSnapshotService formSnapshotService;
    private final FormSchemaService formSchemaService;

    public ProcessInstanceAppService(
            ProcessFacade processFacade,
            AuditLogService auditLogService,
            AuditLogQueryService auditLogQueryService,
            FormSnapshotService formSnapshotService,
            FormSchemaService formSchemaService
    ) {
        this.processFacade = processFacade;
        this.auditLogService = auditLogService;
        this.auditLogQueryService = auditLogQueryService;
        this.formSnapshotService = formSnapshotService;
        this.formSchemaService = formSchemaService;
    }

    @Transactional
    public ProcessInstanceDTO start(StartProcessRequest request) {
        FormSchemaResponse formSchema = null;
        if (StringUtils.hasText(request.formSchemaId()) && request.formData() != null) {
            formSchema = formSchemaService.get(request.formSchemaId());
        }
        Map<String, Object> variables = request.variables() != null
                ? request.variables()
                : request.formData() == null ? Map.of() : request.formData();
        ProcessInstanceDTO instance = processFacade.start(new StartProcessCommand(
                TenantContextHolder.getTenantId(),
                UserContextHolder.getUserId(),
                RequestContextHolder.getRequestId(),
                request.processDefinitionKey(),
                request.businessKey(),
                variables
        ));
        if (formSchema != null) {
            formSnapshotService.saveSnapshot(
                    instance.instanceId(),
                    null,
                    request.formSchemaId(),
                    formSchema,
                    request.formData()
            );
        }
        auditLogService.record("PROCESS_INSTANCE_START", "PROCESS_INSTANCE", instance.instanceId(), startAuditDetail(request, instance));
        return instance;
    }

    public ProcessInstanceDetailResponse get(String instanceId) {
        ProcessInstanceDetailDTO instance = processFacade.getInstance(TenantContextHolder.getTenantId(), instanceId);
        return ProcessInstanceDetailResponse.from(
                instance,
                auditLogQueryService.queryByResource("PROCESS_INSTANCE", instanceId, 20)
        );
    }

    private Map<String, Object> startAuditDetail(StartProcessRequest request, ProcessInstanceDTO instance) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("processDefinitionKey", request.processDefinitionKey());
        detail.put("processDefinitionId", instance.processDefinitionId());
        detail.put("status", instance.status());
        detail.put("businessKey", request.businessKey());
        if (StringUtils.hasText(request.formSchemaId())) {
            detail.put("formSchemaId", request.formSchemaId());
        }
        return detail;
    }
}
