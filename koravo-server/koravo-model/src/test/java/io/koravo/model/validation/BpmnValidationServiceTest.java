package io.koravo.model.validation;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BpmnValidationServiceTest {
    private final BpmnValidationService service = new BpmnValidationService();

    @Test
    void validExecutableProcessHasNoErrors() {
        BpmnValidationResult result = service.validate("""
                <?xml version="1.0" encoding="UTF-8"?>
                <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
                             xmlns:flowable="http://flowable.org/bpmn">
                  <process id="demo" name="Demo" isExecutable="true">
                    <startEvent id="start"/>
                    <sequenceFlow id="flow1" sourceRef="start" targetRef="approve"/>
                    <userTask id="approve" name="Approve" flowable:assignee="${startUserId}"/>
                    <sequenceFlow id="flow2" sourceRef="approve" targetRef="end"/>
                    <endEvent id="end"/>
                  </process>
                </definitions>
                """);

        assertThat(result.valid()).isTrue();
        assertThat(result.errors()).isEmpty();
    }

    @Test
    void userTaskWithoutAssigneeReturnsError() {
        BpmnValidationResult result = service.validate("""
                <?xml version="1.0" encoding="UTF-8"?>
                <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
                  <process id="demo" name="Demo" isExecutable="true">
                    <startEvent id="start"/>
                    <sequenceFlow id="flow1" sourceRef="start" targetRef="approve"/>
                    <userTask id="approve" name="Approve"/>
                    <sequenceFlow id="flow2" sourceRef="approve" targetRef="end"/>
                    <endEvent id="end"/>
                  </process>
                </definitions>
                """);

        assertThat(result.valid()).isFalse();
        assertThat(result.errors())
                .extracting(BpmnValidationIssue::code)
                .contains("BPMN_USER_TASK_ASSIGNEE_REQUIRED");
    }

    @Test
    void blankXmlReturnsError() {
        BpmnValidationResult result = service.validate(" ");

        assertThat(result.valid()).isFalse();
        assertThat(result.errors()).extracting(BpmnValidationIssue::message)
                .contains("BPMN XML is required");
    }

    @Test
    void nonExecutableProcessReturnsWarning() {
        BpmnValidationResult result = service.validate("""
                <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
                  <process id="draft">
                    <startEvent id="start"/>
                    <endEvent id="end"/>
                  </process>
                </definitions>
                """);

        assertThat(result.valid()).isTrue();
        assertThat(result.warnings()).extracting(BpmnValidationIssue::message)
                .contains("Process draft is not executable");
    }
}
