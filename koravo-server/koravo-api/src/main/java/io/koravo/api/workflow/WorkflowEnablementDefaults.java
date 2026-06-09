package io.koravo.api.workflow;

public final class WorkflowEnablementDefaults {
    public static final String TENANT_ID = "default";
    public static final String USER_ID = "admin";
    public static final String PROCESS_KEY = "multiAcceptance";
    public static final String PROCESS_NAME = "多人验收流程";
    public static final String FORM_KEY = "acceptance-request-form";
    public static final String FORM_NAME = "验收申请表";
    public static final String START_FORM_TASK_KEY = "__START__";
    public static final String BUSINESS_ACCEPTANCE_TASK_KEY = "businessAcceptanceTask";
    public static final String FINANCE_ACCEPTANCE_TASK_KEY = "financeAcceptanceTask";
    public static final String PRIMARY_TASK_KEY = BUSINESS_ACCEPTANCE_TASK_KEY;

    private WorkflowEnablementDefaults() {
    }

    public static String acceptanceBpmn() {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
                             xmlns:flowable="http://flowable.org/bpmn"
                             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                             xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"
                             xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI"
                             targetNamespace="https://koravo.io/workflow">
                  <process id="multiAcceptance" name="多人验收流程" isExecutable="true">
                    <startEvent id="start" name="开始"/>
                    <sequenceFlow id="flow_start_split" sourceRef="start" targetRef="parallelSplit"/>
                    <parallelGateway id="parallelSplit" name="并行验收"/>
                    <sequenceFlow id="flow_split_business" sourceRef="parallelSplit" targetRef="businessAcceptanceTask"/>
                    <sequenceFlow id="flow_split_finance" sourceRef="parallelSplit" targetRef="financeAcceptanceTask"/>
                    <userTask id="businessAcceptanceTask" name="业务验收" flowable:assignee="${managerApprover}"/>
                    <userTask id="financeAcceptanceTask" name="财务验收" flowable:assignee="${financeApprover}"/>
                    <sequenceFlow id="flow_business_join" sourceRef="businessAcceptanceTask" targetRef="parallelJoin"/>
                    <sequenceFlow id="flow_finance_join" sourceRef="financeAcceptanceTask" targetRef="parallelJoin"/>
                    <parallelGateway id="parallelJoin" name="验收汇总"/>
                    <sequenceFlow id="flow_join_end" sourceRef="parallelJoin" targetRef="end"/>
                    <endEvent id="end" name="完成"/>
                  </process>
                  <bpmndi:BPMNDiagram id="BPMNDiagram_multiAcceptance">
                    <bpmndi:BPMNPlane id="BPMNPlane_multiAcceptance" bpmnElement="multiAcceptance">
                      <bpmndi:BPMNShape id="Shape_start" bpmnElement="start">
                        <omgdc:Bounds x="80" y="160" width="36" height="36"/>
                      </bpmndi:BPMNShape>
                      <bpmndi:BPMNShape id="Shape_parallelSplit" bpmnElement="parallelSplit" isMarkerVisible="true">
                        <omgdc:Bounds x="170" y="153" width="50" height="50"/>
                      </bpmndi:BPMNShape>
                      <bpmndi:BPMNShape id="Shape_businessAcceptanceTask" bpmnElement="businessAcceptanceTask">
                        <omgdc:Bounds x="290" y="80" width="130" height="80"/>
                      </bpmndi:BPMNShape>
                      <bpmndi:BPMNShape id="Shape_financeAcceptanceTask" bpmnElement="financeAcceptanceTask">
                        <omgdc:Bounds x="290" y="210" width="130" height="80"/>
                      </bpmndi:BPMNShape>
                      <bpmndi:BPMNShape id="Shape_parallelJoin" bpmnElement="parallelJoin" isMarkerVisible="true">
                        <omgdc:Bounds x="500" y="153" width="50" height="50"/>
                      </bpmndi:BPMNShape>
                      <bpmndi:BPMNShape id="Shape_end" bpmnElement="end">
                        <omgdc:Bounds x="630" y="160" width="36" height="36"/>
                      </bpmndi:BPMNShape>
                      <bpmndi:BPMNEdge id="Edge_flow_start_split" bpmnElement="flow_start_split">
                        <omgdi:waypoint x="116" y="178"/>
                        <omgdi:waypoint x="170" y="178"/>
                      </bpmndi:BPMNEdge>
                      <bpmndi:BPMNEdge id="Edge_flow_split_business" bpmnElement="flow_split_business">
                        <omgdi:waypoint x="195" y="153"/>
                        <omgdi:waypoint x="195" y="120"/>
                        <omgdi:waypoint x="290" y="120"/>
                      </bpmndi:BPMNEdge>
                      <bpmndi:BPMNEdge id="Edge_flow_split_finance" bpmnElement="flow_split_finance">
                        <omgdi:waypoint x="195" y="203"/>
                        <omgdi:waypoint x="195" y="250"/>
                        <omgdi:waypoint x="290" y="250"/>
                      </bpmndi:BPMNEdge>
                      <bpmndi:BPMNEdge id="Edge_flow_business_join" bpmnElement="flow_business_join">
                        <omgdi:waypoint x="420" y="120"/>
                        <omgdi:waypoint x="525" y="120"/>
                        <omgdi:waypoint x="525" y="153"/>
                      </bpmndi:BPMNEdge>
                      <bpmndi:BPMNEdge id="Edge_flow_finance_join" bpmnElement="flow_finance_join">
                        <omgdi:waypoint x="420" y="250"/>
                        <omgdi:waypoint x="525" y="250"/>
                        <omgdi:waypoint x="525" y="203"/>
                      </bpmndi:BPMNEdge>
                      <bpmndi:BPMNEdge id="Edge_flow_join_end" bpmnElement="flow_join_end">
                        <omgdi:waypoint x="550" y="178"/>
                        <omgdi:waypoint x="630" y="178"/>
                      </bpmndi:BPMNEdge>
                    </bpmndi:BPMNPlane>
                  </bpmndi:BPMNDiagram>
                </definitions>
                """;
    }

    public static String acceptanceFormSchema() {
        return """
                {
                  "type": "object",
                  "required": ["applicant", "department", "subject", "acceptanceScope", "managerApprover", "financeApprover"],
                  "properties": {
                    "applicant": {
                      "type": "string",
                      "title": "申请人"
                    },
                    "department": {
                      "type": "string",
                      "title": "申请部门"
                    },
                    "subject": {
                      "type": "string",
                      "title": "申请主题"
                    },
                    "acceptanceScope": {
                      "type": "string",
                      "title": "验收事项",
                      "ui:widget": "textarea"
                    },
                    "expectedResult": {
                      "type": "string",
                      "title": "验收标准",
                      "ui:widget": "textarea"
                    },
                    "amount": {
                      "type": "number",
                      "title": "关联金额"
                    },
                    "managerApprover": {
                      "type": "string",
                      "title": "业务验收人"
                    },
                    "financeApprover": {
                      "type": "string",
                      "title": "财务验收人"
                    },
                    "accepted": {
                      "type": "boolean",
                      "title": "验收通过"
                    },
                    "reviewComment": {
                      "type": "string",
                      "title": "验收意见",
                      "ui:widget": "textarea"
                    },
                    "remark": {
                      "type": "string",
                      "title": "备注",
                      "ui:widget": "textarea"
                    }
                  }
                }
                """;
    }

    public static String acceptanceFormUiSchema() {
        return """
                {
                  "applicant": {
                    "widget": "organizationProfile"
                  },
                  "department": {
                    "widget": "organizationProfile"
                  },
                  "managerApprover": {
                    "widget": "organizationMember"
                  },
                  "financeApprover": {
                    "widget": "organizationMember"
                  },
                  "acceptanceScope": {
                    "widget": "textarea"
                  },
                  "expectedResult": {
                    "widget": "textarea"
                  },
                  "reviewComment": {
                    "widget": "textarea"
                  },
                  "remark": {
                    "widget": "textarea"
                  }
                }
                """;
    }
}
