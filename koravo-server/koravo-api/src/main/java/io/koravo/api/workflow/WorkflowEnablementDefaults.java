package io.koravo.api.workflow;

public final class WorkflowEnablementDefaults {
    public static final String TENANT_ID = "default";
    public static final String USER_ID = "admin";
    public static final String PROCESS_KEY = "collaborativeApproval";
    public static final String PROCESS_NAME = "协同审批流程";
    public static final String FORM_KEY = "business-request-form";
    public static final String FORM_NAME = "业务申请表";
    public static final String START_FORM_TASK_KEY = "__START__";
    public static final String BUSINESS_ACCEPTANCE_TASK_KEY = "businessReviewTask";
    public static final String FINANCE_ACCEPTANCE_TASK_KEY = "financeReviewTask";
    public static final String PRIMARY_TASK_KEY = BUSINESS_ACCEPTANCE_TASK_KEY;

    private WorkflowEnablementDefaults() {
    }

    public static String businessRequestBpmn() {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
                             xmlns:flowable="http://flowable.org/bpmn"
                             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                             xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"
                             xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI"
                             targetNamespace="https://koravo.io/workflow">
                  <process id="collaborativeApproval" name="协同审批流程" isExecutable="true">
                    <startEvent id="start" name="开始"/>
                    <sequenceFlow id="flow_start_split" sourceRef="start" targetRef="parallelSplit"/>
                    <parallelGateway id="parallelSplit" name="并行审批"/>
                    <sequenceFlow id="flow_split_business" sourceRef="parallelSplit" targetRef="businessReviewTask"/>
                    <sequenceFlow id="flow_split_finance" sourceRef="parallelSplit" targetRef="financeReviewTask"/>
                    <userTask id="businessReviewTask" name="业务审批" flowable:assignee="${managerApprover}"/>
                    <userTask id="financeReviewTask" name="财务复核" flowable:assignee="${financeApprover}"/>
                    <sequenceFlow id="flow_business_join" sourceRef="businessReviewTask" targetRef="parallelJoin"/>
                    <sequenceFlow id="flow_finance_join" sourceRef="financeReviewTask" targetRef="parallelJoin"/>
                    <parallelGateway id="parallelJoin" name="审批汇总"/>
                    <sequenceFlow id="flow_join_end" sourceRef="parallelJoin" targetRef="end"/>
                    <endEvent id="end" name="完成"/>
                  </process>
                  <bpmndi:BPMNDiagram id="BPMNDiagram_collaborativeApproval">
                    <bpmndi:BPMNPlane id="BPMNPlane_collaborativeApproval" bpmnElement="collaborativeApproval">
                      <bpmndi:BPMNShape id="Shape_start" bpmnElement="start">
                        <omgdc:Bounds x="80" y="160" width="36" height="36"/>
                      </bpmndi:BPMNShape>
                      <bpmndi:BPMNShape id="Shape_parallelSplit" bpmnElement="parallelSplit" isMarkerVisible="true">
                        <omgdc:Bounds x="170" y="153" width="50" height="50"/>
                      </bpmndi:BPMNShape>
                      <bpmndi:BPMNShape id="Shape_businessReviewTask" bpmnElement="businessReviewTask">
                        <omgdc:Bounds x="290" y="80" width="130" height="80"/>
                      </bpmndi:BPMNShape>
                      <bpmndi:BPMNShape id="Shape_financeReviewTask" bpmnElement="financeReviewTask">
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

    public static String businessRequestFormSchema() {
        return """
                {
                  "type": "object",
                  "required": ["applicant", "department", "subject", "businessDescription", "managerApprover", "financeApprover"],
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
                    "businessDescription": {
                      "type": "string",
                      "title": "事项内容",
                      "ui:widget": "textarea"
                    },
                    "expectedResult": {
                      "type": "string",
                      "title": "期望结果",
                      "ui:widget": "textarea"
                    },
                    "amount": {
                      "type": "number",
                      "title": "关联金额"
                    },
                    "managerApprover": {
                      "type": "string",
                      "title": "业务审批人"
                    },
                    "financeApprover": {
                      "type": "string",
                      "title": "财务复核人"
                    },
                    "approved": {
                      "type": "boolean",
                      "title": "审批通过"
                    },
                    "reviewComment": {
                      "type": "string",
                      "title": "处理意见",
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

    public static String businessRequestFormUiSchema() {
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
                  "businessDescription": {
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
