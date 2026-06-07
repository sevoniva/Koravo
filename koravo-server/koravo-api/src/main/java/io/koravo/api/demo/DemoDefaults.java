package io.koravo.api.demo;

public final class DemoDefaults {
    public static final String TENANT_ID = "default";
    public static final String USER_ID = "admin";
    public static final String PROCESS_KEY = "leaveApproval";
    public static final String PROCESS_NAME = "请假审批流程";
    public static final String FORM_KEY = "leave-form";
    public static final String FORM_NAME = "请假申请表";
    public static final String APPROVE_TASK_KEY = "approveTask";

    private DemoDefaults() {
    }

    public static String leaveApprovalBpmn() {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
                             xmlns:flowable="http://flowable.org/bpmn"
                             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                             xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"
                             xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI"
                             targetNamespace="https://koravo.io/demo">
                  <process id="leaveApproval" name="请假审批流程" isExecutable="true">
                    <startEvent id="start" name="开始"/>
                    <sequenceFlow id="flow_start_approve" sourceRef="start" targetRef="approveTask"/>
                    <userTask id="approveTask" name="审批请假" flowable:assignee="${approver}"/>
                    <sequenceFlow id="flow_approve_end" sourceRef="approveTask" targetRef="end"/>
                    <endEvent id="end" name="结束"/>
                  </process>
                  <bpmndi:BPMNDiagram id="BPMNDiagram_leaveApproval">
                    <bpmndi:BPMNPlane id="BPMNPlane_leaveApproval" bpmnElement="leaveApproval">
                      <bpmndi:BPMNShape id="Shape_start" bpmnElement="start">
                        <omgdc:Bounds x="100" y="120" width="36" height="36"/>
                      </bpmndi:BPMNShape>
                      <bpmndi:BPMNShape id="Shape_approveTask" bpmnElement="approveTask">
                        <omgdc:Bounds x="210" y="98" width="120" height="80"/>
                      </bpmndi:BPMNShape>
                      <bpmndi:BPMNShape id="Shape_end" bpmnElement="end">
                        <omgdc:Bounds x="420" y="120" width="36" height="36"/>
                      </bpmndi:BPMNShape>
                      <bpmndi:BPMNEdge id="Edge_flow_start_approve" bpmnElement="flow_start_approve">
                        <omgdi:waypoint x="136" y="138"/>
                        <omgdi:waypoint x="210" y="138"/>
                      </bpmndi:BPMNEdge>
                      <bpmndi:BPMNEdge id="Edge_flow_approve_end" bpmnElement="flow_approve_end">
                        <omgdi:waypoint x="330" y="138"/>
                        <omgdi:waypoint x="420" y="138"/>
                      </bpmndi:BPMNEdge>
                    </bpmndi:BPMNPlane>
                  </bpmndi:BPMNDiagram>
                </definitions>
                """;
    }

    public static String leaveFormSchema() {
        return """
                {
                  "type": "object",
                  "required": ["applicant", "leaveType", "startDate", "endDate", "days", "reason"],
                  "properties": {
                    "applicant": {
                      "type": "string",
                      "title": "申请人"
                    },
                    "leaveType": {
                      "type": "string",
                      "title": "请假类型",
                      "enum": ["年假", "事假", "病假", "调休", "其他"]
                    },
                    "startDate": {
                      "type": "string",
                      "format": "date",
                      "title": "开始日期"
                    },
                    "endDate": {
                      "type": "string",
                      "format": "date",
                      "title": "结束日期"
                    },
                    "days": {
                      "type": "number",
                      "title": "请假天数"
                    },
                    "reason": {
                      "type": "string",
                      "title": "请假原因",
                      "ui:widget": "textarea"
                    },
                    "attachmentNote": {
                      "type": "string",
                      "title": "附件说明",
                      "ui:widget": "textarea"
                    }
                  }
                }
                """;
    }

    public static String leaveFormUiSchema() {
        return """
                {
                  "reason": {
                    "widget": "textarea"
                  },
                  "attachmentNote": {
                    "widget": "textarea"
                  }
                }
                """;
    }
}
