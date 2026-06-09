package io.koravo.api.workflow;

public final class WorkflowEnablementDefaults {
    public static final String TENANT_ID = "default";
    public static final String USER_ID = "admin";
    public static final String PROCESS_KEY = "collaborativeApproval";
    public static final String PROCESS_NAME = "协同审批流程";
    public static final String FORM_KEY = "business-request-form";
    public static final String FORM_NAME = "业务申请表";
    public static final String START_FORM_TASK_KEY = "__START__";
    public static final String BUSINESS_ACCEPTANCE_TASK_KEY = "jointApprovalTask";
    public static final String FINANCE_ACCEPTANCE_TASK_KEY = BUSINESS_ACCEPTANCE_TASK_KEY;
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
                    <sequenceFlow id="flow_start_approval" sourceRef="start" targetRef="jointApprovalTask"/>
                    <userTask id="jointApprovalTask" name="多人会签" flowable:assignee="${approvalUser}">
                      <multiInstanceLoopCharacteristics isSequential="false" flowable:collection="approvalUsers" flowable:elementVariable="approvalUser"/>
                    </userTask>
                    <sequenceFlow id="flow_approval_end" sourceRef="jointApprovalTask" targetRef="end"/>
                    <endEvent id="end" name="完成"/>
                  </process>
                  <bpmndi:BPMNDiagram id="BPMNDiagram_collaborativeApproval">
                    <bpmndi:BPMNPlane id="BPMNPlane_collaborativeApproval" bpmnElement="collaborativeApproval">
                      <bpmndi:BPMNShape id="Shape_start" bpmnElement="start">
                        <omgdc:Bounds x="80" y="160" width="36" height="36"/>
                      </bpmndi:BPMNShape>
                      <bpmndi:BPMNShape id="Shape_jointApprovalTask" bpmnElement="jointApprovalTask">
                        <omgdc:Bounds x="210" y="138" width="150" height="80"/>
                      </bpmndi:BPMNShape>
                      <bpmndi:BPMNShape id="Shape_end" bpmnElement="end">
                        <omgdc:Bounds x="470" y="160" width="36" height="36"/>
                      </bpmndi:BPMNShape>
                      <bpmndi:BPMNEdge id="Edge_flow_start_approval" bpmnElement="flow_start_approval">
                        <omgdi:waypoint x="116" y="178"/>
                        <omgdi:waypoint x="210" y="178"/>
                      </bpmndi:BPMNEdge>
                      <bpmndi:BPMNEdge id="Edge_flow_approval_end" bpmnElement="flow_approval_end">
                        <omgdi:waypoint x="360" y="178"/>
                        <omgdi:waypoint x="470" y="178"/>
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
                  "required": ["applicant", "department", "subject", "businessDescription", "approvalUsers"],
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
                    "approvalUsers": {
                      "type": "array",
                      "title": "审批人",
                      "items": {
                        "type": "string"
                      }
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
                  "approvalUsers": {
                    "widget": "organizationMemberMulti"
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
