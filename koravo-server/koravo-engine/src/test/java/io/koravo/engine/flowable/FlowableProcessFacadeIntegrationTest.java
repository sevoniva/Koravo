package io.koravo.engine.flowable;

import io.koravo.engine.command.CompleteTaskCommand;
import io.koravo.engine.command.DeployProcessCommand;
import io.koravo.engine.command.StartProcessCommand;
import io.koravo.engine.command.TaskQueryCommand;
import io.koravo.engine.dto.TaskDTO;
import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngineConfiguration;
import org.flowable.engine.impl.cfg.StandaloneInMemProcessEngineConfiguration;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class FlowableProcessFacadeIntegrationTest {
    private static final String TENANT_ID = "enterprise-tenant";
    private static final String START_USER = "applicant";
    private static final String PROCESS_KEY = "enterpriseApproval30";

    @Test
    void completeEnterpriseApprovalWithThirtyFourNodesTenDepartmentsTwentyRolesAndSubprocesses() {
        ProcessEngine processEngine = inMemoryEngine();
        try {
            FlowableProcessFacade facade = new FlowableProcessFacade(
                    processEngine.getRepositoryService(),
                    processEngine.getRuntimeService(),
                    processEngine.getTaskService(),
                    processEngine.getHistoryService(),
                    processEngine.getIdentityService(),
                    processEngine.getManagementService()
            );
            EnterpriseApprovalDefinition definition = EnterpriseApprovalDefinition.create();

            assertThat(definition.steps()).hasSize(34);
            assertThat(definition.departments()).hasSize(10);
            assertThat(definition.roles()).hasSize(20);
            assertThat(definition.steps()).filteredOn(ApprovalStep::inSubProcess).hasSize(16);
            assertThat(definition.steps()).filteredOn(ApprovalStep::pooled).hasSize(14);

            var deployment = facade.deploy(new DeployProcessCommand(
                    TENANT_ID,
                    START_USER,
                    PROCESS_KEY,
                    "企业级多部门审批",
                    "enterprise-approval-30-node.bpmn20.xml",
                    definition.bpmnXml()
            ));
            assertThat(deployment.processDefinitionKey()).isEqualTo(PROCESS_KEY);

            var instance = facade.start(new StartProcessCommand(
                    TENANT_ID,
                    START_USER,
                    "req-enterprise-approval-001",
                    PROCESS_KEY,
                    "EA-2026-0001",
                    definition.startVariables()
            ));

            for (ApprovalStep step : definition.steps()) {
                completeApprovalStep(facade, step);
            }

            var detail = facade.getInstance(TENANT_ID, instance.instanceId());
            assertThat(detail.status()).isEqualTo("COMPLETED");
            assertThat(detail.currentTasks()).isEmpty();

            var trace = facade.getInstanceTrace(TENANT_ID, instance.instanceId());
            assertThat(trace.currentTasks()).isEmpty();
            assertThat(trace.timeline())
                    .filteredOn(node -> "userTask".equals(node.activityType()))
                    .hasSize(34)
                    .allSatisfy(node -> assertThat(node.status()).isEqualTo("COMPLETED"));
            assertThat(trace.timeline())
                    .filteredOn(node -> "subProcess".equals(node.activityType()))
                    .hasSize(4)
                    .allSatisfy(node -> assertThat(node.status()).isEqualTo("COMPLETED"));
            assertThat(processEngine.getManagementService().createJobQuery().processInstanceId(instance.instanceId()).count()).isZero();
            assertThat(processEngine.getManagementService().createDeadLetterJobQuery().processInstanceId(instance.instanceId()).count()).isZero();
        } finally {
            processEngine.close();
        }
    }

    private static ProcessEngine inMemoryEngine() {
        StandaloneInMemProcessEngineConfiguration configuration = new StandaloneInMemProcessEngineConfiguration();
        configuration.setJdbcDriver("org.h2.Driver");
        configuration.setJdbcUrl("jdbc:h2:mem:koravo-enterprise-approval-" + System.nanoTime() + ";DB_CLOSE_DELAY=1000");
        configuration.setDatabaseSchemaUpdate(ProcessEngineConfiguration.DB_SCHEMA_UPDATE_TRUE);
        configuration.setHistory("full");
        configuration.setAsyncExecutorActivate(false);
        return configuration.buildProcessEngine();
    }

    private static void completeApprovalStep(FlowableProcessFacade facade, ApprovalStep step) {
        TaskDTO task = step.pooled()
                ? claimPooledTask(facade, step)
                : assignedTask(facade, step);

        facade.completeTask(new CompleteTaskCommand(
                TENANT_ID,
                step.approverUser(),
                task.taskId(),
                Map.of(step.taskId() + "Decision", "APPROVED"),
                step.name() + "通过"
        ));
    }

    private static TaskDTO assignedTask(FlowableProcessFacade facade, ApprovalStep step) {
        var tasks = facade.queryMyTasks(new TaskQueryCommand(
                TENANT_ID,
                step.approverUser(),
                1,
                200,
                null,
                null,
                null,
                null
        ));
        return findTask(tasks.items(), step);
    }

    private static TaskDTO claimPooledTask(FlowableProcessFacade facade, ApprovalStep step) {
        var tasks = facade.queryCandidateTasks(new TaskQueryCommand(
                TENANT_ID,
                step.approverUser(),
                step.primaryCandidateRole(),
                1,
                200,
                null,
                null,
                null,
                null
        ));
        TaskDTO candidate = findTask(tasks.items(), step);
        return facade.claimTask(TENANT_ID, step.approverUser(), candidate.taskId(), step.name() + "认领");
    }

    private static TaskDTO findTask(List<TaskDTO> tasks, ApprovalStep step) {
        return tasks.stream()
                .filter(task -> step.taskId().equals(task.taskDefinitionKey()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Missing active task " + step.taskId()));
    }

    private static String readEnterpriseApprovalBpmn() {
        Path directory = Path.of(System.getProperty("user.dir")).toAbsolutePath();
        while (directory != null) {
            Path candidate = directory.resolve("examples/bpmn/enterprise-approval-30-node.bpmn20.xml");
            if (Files.exists(candidate)) {
                try {
                    return Files.readString(candidate);
                } catch (IOException e) {
                    throw new UncheckedIOException("Failed to read enterprise approval BPMN example", e);
                }
            }
            directory = directory.getParent();
        }
        throw new IllegalStateException("examples/bpmn/enterprise-approval-30-node.bpmn20.xml not found");
    }

    private record EnterpriseApprovalDefinition(
            String bpmnXml,
            List<ApprovalStep> steps,
            List<String> departments,
            List<String> roles,
            Map<String, Object> startVariables
    ) {
        private static EnterpriseApprovalDefinition create() {
            List<ApprovalStep> steps = new ArrayList<>();
            List<String> departments = new ArrayList<>();
            List<String> roles = new ArrayList<>();
            Map<String, Object> variables = new LinkedHashMap<>();
            for (int roleIndex = 1; roleIndex <= 20; roleIndex += 1) {
                roles.add(roleName(roleIndex));
                variables.put(roleVariable(roleIndex), approverUser(roleIndex));
            }

            for (int departmentIndex = 1; departmentIndex <= 10; departmentIndex += 1) {
                String department = "dept-%02d".formatted(departmentIndex);
                departments.add(department);
                int roleA = departmentIndex * 2 - 1;
                int roleB = departmentIndex * 2;
                boolean subProcess = departmentIndex == 3 || departmentIndex == 5 || departmentIndex == 7 || departmentIndex == 9;
                int taskCount = subProcess ? 4 : 3;
                for (int taskIndex = 1; taskIndex <= taskCount; taskIndex += 1) {
                    boolean pooled = taskIndex == 2 || (subProcess && taskIndex == 4);
                    int roleIndex = taskIndex % 2 == 0 ? roleB : roleA;
                    steps.add(new ApprovalStep(
                            "dept%02d_approval_%02d".formatted(departmentIndex, taskIndex),
                            "部门%02d审批节点%02d".formatted(departmentIndex, taskIndex),
                            department,
                            roleName(roleIndex),
                            pooled ? List.of(roleName(roleA), roleName(roleB)) : List.of(),
                            approverUser(roleIndex),
                            subProcess
                    ));
                }
            }

            variables.put("applicant", "大型流程发起人");
            variables.put("departmentCount", departments.size());
            variables.put("roleCount", roles.size());
            variables.put("approvalNodeCount", steps.size());
            return new EnterpriseApprovalDefinition(
                    readEnterpriseApprovalBpmn(),
                    List.copyOf(steps),
                    List.copyOf(departments),
                    List.copyOf(roles),
                    Map.copyOf(variables)
            );
        }
    }

    private record ApprovalStep(
            String taskId,
            String name,
            String department,
            String role,
            List<String> candidateRoles,
            String approverUser,
            boolean inSubProcess
    ) {
        private boolean pooled() {
            return !candidateRoles.isEmpty();
        }

        private String primaryCandidateRole() {
            return candidateRoles.isEmpty() ? role : candidateRoles.get(0);
        }
    }

    private static String roleName(int roleIndex) {
        return "role-%02d".formatted(roleIndex);
    }

    private static String roleVariable(int roleIndex) {
        return "role%02dUser".formatted(roleIndex);
    }

    private static String approverUser(int roleIndex) {
        return "user-role-%02d".formatted(roleIndex);
    }
}
