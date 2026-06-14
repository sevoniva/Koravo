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
import io.koravo.engine.dto.ProcessTraceDTO;
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

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class ProcessInstanceAppService {
    private static final String ACTIVE = "ACTIVE";
    private static final String APPLICANT_FIELD = "applicant";
    private static final String DEPARTMENT_FIELD = "department";
    private static final String POSITION_FIELD = "position";
    private static final String MANAGER_APPROVER_FIELD = "managerApprover";
    private static final String FINANCE_APPROVER_FIELD = "financeApprover";
    private static final String APPROVAL_USERS_FIELD = "approvalUsers";
    private static final List<String> APPLICANT_FIELD_ALIASES = List.of(
            APPLICANT_FIELD,
            "applicantName",
            "applicantUser",
            "applicantUserId",
            "applicantUsername",
            "requesterName",
            "requesterUser",
            "requesterUserId",
            "requesterUsername",
            "requester",
            "applyUser",
            "applyUserId",
            "applyUsername",
            "applyEmployee",
            "applyEmployeeName",
            "submitUser",
            "submitUserId",
            "submitUsername",
            "submitter",
            "startUser",
            "startUserId",
            "startUsername",
            "initiator",
            "initiatorName",
            "createdBy",
            "creatorName",
            "creator"
    );
    private static final List<String> DEPARTMENT_FIELD_ALIASES = List.of(
            DEPARTMENT_FIELD,
            "departmentName",
            "dept",
            "deptName",
            "orgDepartment",
            "orgDept",
            "applyDept",
            "applyDeptName",
            "applyDepartment",
            "applyDepartmentName",
            "applicantDepartment",
            "applicantDept",
            "applicantDepartmentName",
            "requesterDept",
            "requesterDepartment",
            "requesterDepartmentName",
            "submitDept",
            "submitDepartment",
            "submitDepartmentName",
            "startDept",
            "startDepartment",
            "startDepartmentName",
            "applyUnit",
            "applyUnitName",
            "applicantUnit",
            "applicantUnitName",
            "requesterUnit",
            "requesterUnitName",
            "submitUnit",
            "submitUnitName",
            "organizationUnit"
    );
    private static final List<String> POSITION_FIELD_ALIASES = List.of(
            POSITION_FIELD,
            "positionName",
            "jobTitle",
            "jobPosition",
            "jobRole",
            "role",
            "roleName",
            "roleCode",
            "post",
            "postName",
            "duty",
            "dutyName",
            "responsibility",
            "responsibilityName",
            "applicantPosition",
            "applicantRole",
            "requesterPosition",
            "requesterRole",
            "submitPosition",
            "submitRole",
            "startPosition",
            "startRole"
    );
    private static final List<String> APPROVAL_USER_FIELDS = List.of(
            APPROVAL_USERS_FIELD,
            MANAGER_APPROVER_FIELD,
            FINANCE_APPROVER_FIELD,
            "approvalUser",
            "approvalUserId",
            "approver",
            "approverUser",
            "approverUserId",
            "approvers",
            "reviewer",
            "reviewerUser",
            "reviewerUserId",
            "reviewers",
            "assignee",
            "assigneeUser",
            "assigneeUserId",
            "assignees",
            "handler",
            "handlerUser",
            "handlerUserId",
            "handlers",
            "processor",
            "processorUser",
            "processorUserId",
            "processors"
    );

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
            formSchema = request.formSchemaVersion() == null
                    ? formSchemaService.get(request.formSchemaId())
                    : formSchemaService.get(request.formSchemaId(), request.formSchemaVersion());
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
                auditLogQueryService.query(null, null, null, instanceId, null, null, null, 1, 20).items()
        );
    }

    public ProcessTraceDTO trace(String instanceId) {
        return processFacade.getInstanceTrace(TenantContextHolder.getTenantId(), instanceId);
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
        List<String> approvalUsers = trustedApprovalUsers(
                tenantId,
                request.processDefinitionKey(),
                submittedVariables
        );
        return new TrustedStartIdentity(
                starter.getName(),
                starter.getDepartment(),
                roleLabel(starter.getRole()),
                approvalUsers
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
                containsAnyField(data, APPLICANT_FIELD_ALIASES)
                        || containsAnyField(data, DEPARTMENT_FIELD_ALIASES)
                        || containsAnyField(data, POSITION_FIELD_ALIASES)
                        || containsAnyField(data, APPROVAL_USER_FIELDS)
        );
    }

    private boolean containsAnyField(Map<String, Object> data, List<String> fields) {
        return fields.stream().anyMatch(data::containsKey);
    }

    private List<String> trustedApprovalUsers(String tenantId, String processDefinitionKey, Map<String, Object> submittedVariables) {
        List<String> requestedUsers = requestedApprovalUsers(submittedVariables);
        if (requestedUsers.isEmpty()) {
            requestedUsers = defaultApprovalUsers(tenantId);
        }
        if (WorkflowEnablementDefaults.PROCESS_KEY.equals(processDefinitionKey) && requestedUsers.size() < 2) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "协同审批至少选择两名审批人");
        }
        List<KoOrganizationMember> activeMembers = organizationMemberRepository
                .findByTenantIdAndUserIdInAndStatusAndDeletedFalse(tenantId, requestedUsers, ACTIVE);
        Set<String> activeUserIds = activeMembers.stream()
                .map(KoOrganizationMember::getUserId)
                .collect(java.util.stream.Collectors.toSet());
        List<String> rejectedUsers = requestedUsers.stream()
                .filter(userId -> !activeUserIds.contains(userId))
                .toList();
        if (!rejectedUsers.isEmpty()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "审批人不属于当前租户或已停用");
        }
        return requestedUsers;
    }

    private List<String> requestedApprovalUsers(Map<String, Object> submittedVariables) {
        if (submittedVariables == null) {
            return List.of();
        }
        Set<String> users = new LinkedHashSet<>();
        APPROVAL_USER_FIELDS.forEach(field -> addApprovalUsers(users, submittedVariables.get(field)));
        return new ArrayList<>(users);
    }

    private void addApprovalUsers(Set<String> users, Object value) {
        if (value instanceof Iterable<?> iterable) {
            iterable.forEach(item -> addApprovalUsers(users, item));
            return;
        }
        String userId = value == null ? "" : String.valueOf(value).trim();
        if (!userId.isBlank()) {
            users.add(userId);
        }
    }

    private List<String> defaultApprovalUsers(String tenantId) {
        Set<String> users = new LinkedHashSet<>();
        organizationMemberRepository
                .findFirstByTenantIdAndRoleAndStatusAndDeletedFalseOrderByNameAsc(tenantId, UserContextHolder.ROLE_MANAGER, ACTIVE)
                .map(KoOrganizationMember::getUserId)
                .ifPresent(users::add);
        organizationMemberRepository
                .findFirstByTenantIdAndRoleAndStatusAndDeletedFalseOrderByNameAsc(tenantId, UserContextHolder.ROLE_FINANCE, ACTIVE)
                .map(KoOrganizationMember::getUserId)
                .ifPresent(users::add);
        if (users.isEmpty()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "当前租户缺少启用的审批人");
        }
        return new ArrayList<>(users);
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
        result.put(POSITION_FIELD, identity.position());
        applyIdentityAliases(source, result, APPLICANT_FIELD_ALIASES, identity.applicantName());
        applyIdentityAliases(source, result, DEPARTMENT_FIELD_ALIASES, identity.department());
        applyIdentityAliases(source, result, POSITION_FIELD_ALIASES, identity.position());
        applyApprovalAliases(source, result, identity.approvalUsers());
        result.put(APPROVAL_USERS_FIELD, identity.approvalUsers());
        result.remove(MANAGER_APPROVER_FIELD);
        result.remove(FINANCE_APPROVER_FIELD);
        return result;
    }

    private void applyIdentityAliases(
            Map<String, Object> source,
            Map<String, Object> result,
            List<String> aliases,
            String value
    ) {
        aliases.stream()
                .filter(source::containsKey)
                .forEach(alias -> result.put(alias, value));
    }

    private void applyApprovalAliases(
            Map<String, Object> source,
            Map<String, Object> result,
            List<String> approvalUsers
    ) {
        APPROVAL_USER_FIELDS.stream()
                .filter(field -> !MANAGER_APPROVER_FIELD.equals(field))
                .filter(field -> !FINANCE_APPROVER_FIELD.equals(field))
                .filter(source::containsKey)
                .forEach(field -> result.put(field, approvalValueForShape(source.get(field), approvalUsers)));
    }

    private Object approvalValueForShape(Object sourceValue, List<String> approvalUsers) {
        if (sourceValue instanceof Iterable<?>) {
            return approvalUsers;
        }
        return approvalUsers.isEmpty() ? "" : approvalUsers.getFirst();
    }

    private String roleLabel(String role) {
        return switch (role) {
            case UserContextHolder.ROLE_ADMIN -> "管理员";
            case UserContextHolder.ROLE_MANAGER -> "审批人";
            case UserContextHolder.ROLE_FINANCE -> "复核人";
            case UserContextHolder.ROLE_OPERATOR -> "运维审计人";
            case UserContextHolder.ROLE_APPLICANT -> "发起人";
            default -> "发起人";
        };
    }

    private record TrustedStartIdentity(
            String applicantName,
            String department,
            String position,
            List<String> approvalUsers
    ) {
    }
}
