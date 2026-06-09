package io.koravo.api.service;

import io.koravo.api.organization.KoOrganizationMember;
import io.koravo.api.organization.OrganizationMemberRepository;
import io.koravo.api.web.StartProcessRequest;
import io.koravo.api.workflow.WorkflowEnablementDefaults;
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
import io.koravo.ops.audit.dto.AuditLogResponse;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProcessInstanceAppServiceTest {
    private final ProcessFacade processFacade = mock(ProcessFacade.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final AuditLogQueryService auditLogQueryService = mock(AuditLogQueryService.class);
    private final FormSnapshotService formSnapshotService = mock(FormSnapshotService.class);
    private final FormSchemaService formSchemaService = mock(FormSchemaService.class);
    private final OrganizationMemberRepository organizationMemberRepository = mock(OrganizationMemberRepository.class);
    private final ProcessInstanceAppService service = new ProcessInstanceAppService(
            processFacade,
            auditLogService,
            auditLogQueryService,
            formSnapshotService,
            formSchemaService,
            organizationMemberRepository
    );

    @AfterEach
    void tearDown() {
        RequestContextHolder.clear();
        TenantContextHolder.clear();
        UserContextHolder.clear();
    }

    @Test
    void startPassesRuntimeContextAndWritesInstanceAudit() {
        Map<String, Object> variables = Map.of("subject", "合同审批");
        StartProcessRequest request = new StartProcessRequest("generalApproval", "PO-001", variables, null, null);
        ProcessInstanceDTO instance = new ProcessInstanceDTO("pi-1", "pd-1", "PO-001", "RUNNING");
        RequestContextHolder.set("req-1", "127.0.0.1");
        TenantContextHolder.setTenantId("tenant-a");
        UserContextHolder.setUserId("starter");
        when(processFacade.start(new StartProcessCommand(
                "tenant-a",
                "starter",
                "req-1",
                "generalApproval",
                "PO-001",
                variables
        ))).thenReturn(instance);

        ProcessInstanceDTO result = service.start(request);

        assertThat(result).isEqualTo(instance);
        verify(auditLogService).record(eq("PROCESS_INSTANCE_START"), eq("PROCESS_INSTANCE"), eq("pi-1"), eq(Map.of(
                "processDefinitionKey", "generalApproval",
                "processDefinitionId", "pd-1",
                "status", "RUNNING",
                "businessKey", "PO-001"
        )));
    }

    @Test
    void startSavesStartFormSnapshotWhenFormDataProvided() {
        Map<String, Object> formData = Map.of("subject", "合同审批", "amount", 1200);
        StartProcessRequest request = new StartProcessRequest("generalApproval", "REQ-001", formData, "form-1", formData);
        ProcessInstanceDTO instance = new ProcessInstanceDTO("pi-1", "pd-1", "REQ-001", "RUNNING");
        FormSchemaResponse formSchema = new FormSchemaResponse(
                "form-1",
                "general_request",
                "通用事项表单",
                2,
                "{\"type\":\"object\"}",
                "{}",
                "ACTIVE"
        );
        RequestContextHolder.set("req-1", "127.0.0.1");
        TenantContextHolder.setTenantId("tenant-a");
        UserContextHolder.setUserId("starter");
        when(formSchemaService.get("form-1")).thenReturn(formSchema);
        when(processFacade.start(new StartProcessCommand(
                "tenant-a",
                "starter",
                "req-1",
                "generalApproval",
                "REQ-001",
                formData
        ))).thenReturn(instance);

        ProcessInstanceDTO result = service.start(request);

        assertThat(result).isEqualTo(instance);
        verify(formSnapshotService).saveSnapshot("pi-1", null, "form-1", formSchema, formData);
        verify(auditLogService).record(eq("PROCESS_INSTANCE_START"), eq("PROCESS_INSTANCE"), eq("pi-1"), eq(Map.of(
                "processDefinitionKey", "generalApproval",
                "processDefinitionId", "pd-1",
                "status", "RUNNING",
                "businessKey", "REQ-001",
                "formSchemaId", "form-1"
        )));
    }

    @Test
    void startOverridesProtectedIdentityFieldsFromTenantOrganizationDirectory() {
        Map<String, Object> submitted = Map.of(
                "applicant", "伪造申请人",
                "department", "伪造部门",
                "subject", "生产发布",
                "managerApprover", "outside-manager",
                "financeApprover", "outside-finance"
        );
        Map<String, Object> trusted = Map.of(
                "applicant", "真实申请专员",
                "department", "业务二部",
                "subject", "生产发布",
                "managerApprover", "manager-1",
                "financeApprover", "finance-1"
        );
        StartProcessRequest request = new StartProcessRequest(
                WorkflowEnablementDefaults.PROCESS_KEY,
                "REQ-001",
                submitted,
                "form-1",
                submitted
        );
        ProcessInstanceDTO instance = new ProcessInstanceDTO("pi-1", "pd-1", "REQ-001", "RUNNING");
        FormSchemaResponse formSchema = new FormSchemaResponse(
                "form-1",
                WorkflowEnablementDefaults.FORM_KEY,
                WorkflowEnablementDefaults.FORM_NAME,
                2,
                "{\"type\":\"object\"}",
                "{}",
                "ACTIVE"
        );
        RequestContextHolder.set("req-1", "127.0.0.1");
        TenantContextHolder.setTenantId("tenant-a");
        UserContextHolder.setUser("starter", UserContextHolder.ROLE_APPLICANT);
        when(formSchemaService.get("form-1")).thenReturn(formSchema);
        when(organizationMemberRepository.findByTenantIdAndUserIdAndDeletedFalse("tenant-a", "starter"))
                .thenReturn(Optional.of(member("starter", "真实申请专员", "业务二部", UserContextHolder.ROLE_APPLICANT)));
        when(organizationMemberRepository.findFirstByTenantIdAndRoleAndStatusAndDeletedFalseOrderByNameAsc(
                "tenant-a",
                UserContextHolder.ROLE_MANAGER,
                "ACTIVE"
        )).thenReturn(Optional.of(member("manager-1", "业务负责人", "业务二部", UserContextHolder.ROLE_MANAGER)));
        when(organizationMemberRepository.findFirstByTenantIdAndRoleAndStatusAndDeletedFalseOrderByNameAsc(
                "tenant-a",
                UserContextHolder.ROLE_FINANCE,
                "ACTIVE"
        )).thenReturn(Optional.of(member("finance-1", "财务负责人", "财务部", UserContextHolder.ROLE_FINANCE)));
        when(processFacade.start(new StartProcessCommand(
                "tenant-a",
                "starter",
                "req-1",
                WorkflowEnablementDefaults.PROCESS_KEY,
                "REQ-001",
                trusted
        ))).thenReturn(instance);

        ProcessInstanceDTO result = service.start(request);

        assertThat(result).isEqualTo(instance);
        verify(formSnapshotService).saveSnapshot("pi-1", null, "form-1", formSchema, trusted);
    }

    @Test
    void getReturnsInstanceDetailWithAuditLogs() {
        TenantContextHolder.setTenantId("tenant-a");
        ProcessInstanceDetailDTO instance = new ProcessInstanceDetailDTO(
                "pi-1",
                "pd-1",
                "PO-001",
                "starter",
                Instant.parse("2026-06-07T00:00:00Z"),
                null,
                "RUNNING",
                List.of()
        );
        AuditLogResponse auditLog = new AuditLogResponse(
                "audit-1",
                "tenant-a",
                "starter",
                "PROCESS_INSTANCE_START",
                "PROCESS_INSTANCE",
                "pi-1",
                "req-1",
                "127.0.0.1",
                "{\"businessKey\":\"PO-001\"}",
                Instant.parse("2026-06-07T00:00:00Z")
        );
        when(processFacade.getInstance("tenant-a", "pi-1")).thenReturn(instance);
        when(auditLogQueryService.queryByResource("PROCESS_INSTANCE", "pi-1", 20)).thenReturn(List.of(auditLog));

        var detail = service.get("pi-1");

        assertThat(detail.instanceId()).isEqualTo("pi-1");
        assertThat(detail.auditLogs()).containsExactly(auditLog);
    }

    private KoOrganizationMember member(String userId, String name, String department, String role) {
        KoOrganizationMember member = new KoOrganizationMember();
        member.setTenantId("tenant-a");
        member.setUserId(userId);
        member.setName(name);
        member.setDepartment(department);
        member.setRole(role);
        member.setStatus("ACTIVE");
        return member;
    }
}
