package io.koravo.ops.service;

import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.InstanceQueryCommand;
import io.koravo.common.workflow.RuntimeVisibilityPolicy;
import io.koravo.engine.dto.OpsJobDTO;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentCaptor.forClass;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProcessOpsServiceTest {
    private final ProcessFacade processFacade = mock(ProcessFacade.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final ProcessOpsService service = new ProcessOpsService(processFacade, auditLogService);

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    void listInstancesPassesKeywordAndStatusToFacade() {
        TenantContextHolder.setTenantId("default");

        service.listInstances(2, 15, "PO-1001", "COMPLETED");

        var commandCaptor = forClass(InstanceQueryCommand.class);
        verify(processFacade).listInstances(commandCaptor.capture());
        assertThat(commandCaptor.getValue())
                .extracting(
                        InstanceQueryCommand::tenantId,
                        InstanceQueryCommand::page,
                        InstanceQueryCommand::pageSize,
                        InstanceQueryCommand::keyword,
                        InstanceQueryCommand::status,
                        InstanceQueryCommand::excludedProcessDefinitionKeys,
                        InstanceQueryCommand::excludedBusinessKeyPatterns
                )
                .containsExactly(
                        "default",
                        2,
                        15,
                        "PO-1001",
                        "COMPLETED",
                        RuntimeVisibilityPolicy.HIDDEN_PROCESS_DEFINITION_PATTERNS,
                        RuntimeVisibilityPolicy.HIDDEN_BUSINESS_KEY_PATTERNS
                );
    }

    @Test
    void listInstancesCanIncludeNonProductionForVerificationReview() {
        TenantContextHolder.setTenantId("default");

        service.listInstances(1, 20, null, null, true);

        var commandCaptor = forClass(InstanceQueryCommand.class);
        verify(processFacade).listInstances(commandCaptor.capture());
        assertThat(commandCaptor.getValue())
                .extracting(
                        InstanceQueryCommand::excludedProcessDefinitionKeys,
                        InstanceQueryCommand::excludedBusinessKeyPatterns
                )
                .containsExactly(java.util.Set.of(), java.util.Set.of());
    }

    @Test
    void terminateInstanceCallsFacadeAndWritesAuditLog() {
        TenantContextHolder.setTenantId("default");

        service.terminateInstance("pi-1", "bad data");

        verify(processFacade).terminateProcessInstance("default", "pi-1", "bad data");
        verify(auditLogService).record(eq("PROCESS_INSTANCE_TERMINATE"), eq("PROCESS_INSTANCE"), eq("pi-1"), eq(java.util.Map.of(
                "reason", "bad data"
        )));
    }

    @Test
    void suspendInstanceCallsFacadeAndWritesAuditLog() {
        TenantContextHolder.setTenantId("default");

        service.suspendInstance("pi-1", "等待业务确认");

        verify(processFacade).suspendProcessInstance("default", "pi-1");
        verify(auditLogService).record(eq("PROCESS_INSTANCE_SUSPEND"), eq("PROCESS_INSTANCE"), eq("pi-1"), eq(java.util.Map.of(
                "reason", "等待业务确认"
        )));
    }

    @Test
    void activateInstanceCallsFacadeAndWritesAuditLog() {
        TenantContextHolder.setTenantId("default");

        service.activateInstance("pi-1", "继续处理");

        verify(processFacade).activateProcessInstance("default", "pi-1");
        verify(auditLogService).record(eq("PROCESS_INSTANCE_ACTIVATE"), eq("PROCESS_INSTANCE"), eq("pi-1"), eq(java.util.Map.of(
                "reason", "继续处理"
        )));
    }

    @Test
    void capabilitiesExposeAvailableOpsBoundaries() {
        var capabilities = service.capabilities();

        org.assertj.core.api.Assertions.assertThat(capabilities)
                .extracting("key")
                .contains(
                        "PROCESS_INSTANCE_TRACE",
                        "CONNECTOR_EXECUTION_LOGS",
                        "FAILED_TASK_INSPECTION",
                        "DEAD_LETTER_TASKS",
                        "JOB_RETRY"
                );
        org.assertj.core.api.Assertions.assertThat(capabilities)
                .extracting("status")
                .containsOnly("AVAILABLE");
        org.assertj.core.api.Assertions.assertThat(capabilities)
                .filteredOn(capability -> capability.key().equals("PROCESS_INSTANCE_TRACE"))
                .extracting("status")
                .containsExactly("AVAILABLE");
        org.assertj.core.api.Assertions.assertThat(capabilities)
                .filteredOn(capability -> capability.key().equals("JOB_RETRY"))
                .extracting("status")
                .containsExactly("AVAILABLE");
    }

    @Test
    void retryFailedJobCallsFacadeAndWritesAuditLog() {
        TenantContextHolder.setTenantId("default");
        when(processFacade.getFailedJob("default", "job-1")).thenReturn(job("FAILED"));

        service.retryFailedJob("job-1", 2);

        verify(processFacade).retryFailedJob("default", "job-1", 2);
        var detailCaptor = forClass(Map.class);
        verify(auditLogService).record(eq("FAILED_JOB_RETRY"), eq("FAILED_JOB"), eq("job-1"), detailCaptor.capture());
        assertThat(detailCaptor.getValue())
                .containsEntry("retries", 2)
                .containsEntry("processInstanceId", "pi-1")
                .containsEntry("processDefinitionId", "collaborativeApproval:1:pd")
                .containsEntry("elementName", "多人会签");
    }

    @Test
    void retryDeadLetterJobCallsFacadeAndWritesAuditLog() {
        TenantContextHolder.setTenantId("default");
        when(processFacade.getDeadLetterJob("default", "job-1")).thenReturn(job("DEAD_LETTER"));

        service.retryDeadLetterJob("job-1", 2);

        verify(processFacade).retryDeadLetterJob("default", "job-1", 2);
        var detailCaptor = forClass(Map.class);
        verify(auditLogService).record(eq("DEAD_LETTER_JOB_RETRY"), eq("DEAD_LETTER_JOB"), eq("job-1"), detailCaptor.capture());
        assertThat(detailCaptor.getValue())
                .containsEntry("retries", 2)
                .containsEntry("jobType", "DEAD_LETTER")
                .containsEntry("processInstanceId", "pi-1");
    }

    @Test
    void deleteFailedJobCallsFacadeAndWritesAuditLog() {
        TenantContextHolder.setTenantId("default");
        when(processFacade.getFailedJob("default", "job-1")).thenReturn(job("FAILED"));

        service.deleteFailedJob("job-1");

        verify(processFacade).deleteFailedJob("default", "job-1");
        var detailCaptor = forClass(Map.class);
        verify(auditLogService).record(eq("FAILED_JOB_DELETE"), eq("FAILED_JOB"), eq("job-1"), detailCaptor.capture());
        assertThat(detailCaptor.getValue())
                .containsEntry("processInstanceId", "pi-1")
                .containsEntry("elementId", "jointApprovalTask");
    }

    @Test
    void deleteDeadLetterJobCallsFacadeAndWritesAuditLog() {
        TenantContextHolder.setTenantId("default");
        when(processFacade.getDeadLetterJob("default", "job-1")).thenReturn(job("DEAD_LETTER"));

        service.deleteDeadLetterJob("job-1");

        verify(processFacade).deleteDeadLetterJob("default", "job-1");
        var detailCaptor = forClass(Map.class);
        verify(auditLogService).record(eq("DEAD_LETTER_JOB_DELETE"), eq("DEAD_LETTER_JOB"), eq("job-1"), detailCaptor.capture());
        assertThat(detailCaptor.getValue())
                .containsEntry("jobType", "DEAD_LETTER")
                .containsEntry("processInstanceId", "pi-1");
    }

    private OpsJobDTO job(String type) {
        return new OpsJobDTO(
                "job-1",
                type,
                "default",
                "pi-1",
                "collaborativeApproval:1:pd",
                "execution-1",
                "jointApprovalTask",
                "多人会签",
                "async-continuation",
                "{}",
                0,
                "connector failed",
                null,
                Instant.parse("2026-06-14T00:00:00Z"),
                Instant.parse("2026-06-13T00:00:00Z")
        );
    }
}
