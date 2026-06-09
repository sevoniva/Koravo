package io.koravo.api.service;

import io.koravo.api.organization.KoOrganizationMember;
import io.koravo.api.organization.OrganizationMemberRepository;
import io.koravo.api.web.StartProcessRequest;
import io.koravo.api.web.ProcessInstanceDetailResponse;
import io.koravo.api.workflow.WorkflowEnablementDefaults;
import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
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
    private static final String ACTIVE = "ACTIVE";
    private static final String APPLICANT_FIELD = "applicant";
    private static final String DEPARTMENT_FIELD = "department";
    private static final String MANAGER_APPROVER_FIELD = "managerApprover";
    private static final String FINANCE_APPROVER_FIELD = "financeApprover";

    private final ProcessFacade processFacade;
    private final AuditLogService auditLogService;
    private final AuditLogQueryService auditLogQueryService;
    private final FormSnapshotService formSnapshotService;
    private final FormSchemaService formSchemaService;
    private final OrganizationMemberRepository organizationMemberRepository;

    public ProcessInstanceAppService(
            ProcessFacade processFacade,
            AuditLogService auditLogService,
            AuditLogQueryService auditLogQueryService,
            FormSnapshotService formSnapshotService,
            FormSchemaService formSchemaService,
            OrganizationMemberRepository organizationMemberRepository
    ) {
        this.processFacade = processFacade;
        this.auditLogService = auditLogService;
        this.auditLogQueryService = auditLogQueryService;
        this.formSnapshotService = formSnapshotService;
        this.formSchemaService = formSchemaService;
        this.organizationMemberRepository = organizationMemberRepository;
    }

    @Transactional
    public ProcessInstanceDTO start(StartProcessRequest request) {
        FormSchemaResponse formSchema = null;
        if (StringUtils.hasText(request.formSchemaId()) && request.formData() != null) {
            formSchema = formSchemaService.get(request.formSchemaId());
        }
        Map<String, Object> submittedVariables = request.variables() != null
                ? request.variables()
                : request.formData() == null ? Map.of() : request.formData();
        TrustedStartIdentity trustedIdentity = trustedStartIdentity(request, submittedVariables);
        Map<String, Object> variables = applyTrustedStartIdentity(submittedVariables, trustedIdentity);
        Map<String, Object> snapshotData = request.formData() == null
                ? null
                : applyTrustedStartIdentity(request.formData(), trustedIdentity);
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
                    snapshotData
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

    private TrustedStartIdentity trustedStartIdentity(StartProcessRequest request, Map<String, Object> submittedVariables) {
        if (!requiresTrustedStartIdentity(request, submittedVariables)) {
            return null;
        }
        String tenantId = TenantContextHolder.getTenantId();
        KoOrganizationMember starter = organizationMemberRepository
                .findByTenantIdAndUserIdAndDeletedFalse(tenantId, UserContextHolder.getUserId())
                .filter(member -> ACTIVE.equals(member.getStatus()))
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED, "发起人未同步到当前租户组织"));
        KoOrganizationMember manager = activeMemberByRole(tenantId, UserContextHolder.ROLE_MANAGER, "当前租户缺少启用的业务审批人");
        KoOrganizationMember finance = activeMemberByRole(tenantId, UserContextHolder.ROLE_FINANCE, "当前租户缺少启用的财务复核人");
        return new TrustedStartIdentity(
                starter.getName(),
                starter.getDepartment(),
                manager.getUserId(),
                finance.getUserId()
        );
    }

    private boolean requiresTrustedStartIdentity(StartProcessRequest request, Map<String, Object> submittedVariables) {
        if (WorkflowEnablementDefaults.PROCESS_KEY.equals(request.processDefinitionKey())) {
            return true;
        }
        return containsProtectedStartField(submittedVariables) || containsProtectedStartField(request.formData());
    }

    private boolean containsProtectedStartField(Map<String, Object> data) {
        return data != null && (
                data.containsKey(APPLICANT_FIELD)
                        || data.containsKey(DEPARTMENT_FIELD)
                        || data.containsKey(MANAGER_APPROVER_FIELD)
                        || data.containsKey(FINANCE_APPROVER_FIELD)
        );
    }

    private KoOrganizationMember activeMemberByRole(String tenantId, String role, String errorMessage) {
        return organizationMemberRepository
                .findFirstByTenantIdAndRoleAndStatusAndDeletedFalseOrderByNameAsc(tenantId, role, ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.BAD_REQUEST, errorMessage));
    }

    private Map<String, Object> applyTrustedStartIdentity(Map<String, Object> source, TrustedStartIdentity identity) {
        if (source == null) {
            return null;
        }
        Map<String, Object> result = new LinkedHashMap<>(source);
        if (identity == null) {
            return result;
        }
        result.put(APPLICANT_FIELD, identity.applicantName());
        result.put(DEPARTMENT_FIELD, identity.department());
        result.put(MANAGER_APPROVER_FIELD, identity.managerUserId());
        result.put(FINANCE_APPROVER_FIELD, identity.financeUserId());
        return result;
    }

    private record TrustedStartIdentity(
            String applicantName,
            String department,
            String managerUserId,
            String financeUserId
    ) {
    }
}
