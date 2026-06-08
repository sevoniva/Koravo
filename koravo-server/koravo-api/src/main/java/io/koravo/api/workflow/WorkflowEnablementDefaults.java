package io.koravo.api.workflow;

public final class WorkflowEnablementDefaults {
    public static final String TENANT_ID = "default";
    public static final String USER_ID = "admin";
    public static final String PROCESS_KEY = "purchaseApproval";
    public static final String PROCESS_NAME = "采购申请流程";
    public static final String FORM_KEY = "purchase-request-form";
    public static final String FORM_NAME = "采购申请单";
    public static final String MANAGER_APPROVE_TASK_KEY = "managerApprovalTask";
    public static final String FINANCE_APPROVE_TASK_KEY = "financeApprovalTask";
    public static final String APPROVE_TASK_KEY = MANAGER_APPROVE_TASK_KEY;

    private WorkflowEnablementDefaults() {
    }

    public static String purchaseApprovalBpmn() {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
                             xmlns:flowable="http://flowable.org/bpmn"
                             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                             xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"
                             xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI"
                             targetNamespace="https://koravo.io/workflow">
                  <process id="purchaseApproval" name="采购申请流程" isExecutable="true">
                    <startEvent id="start" name="开始"/>
                    <sequenceFlow id="flow_start_split" sourceRef="start" targetRef="parallelSplit"/>
                    <parallelGateway id="parallelSplit" name="并行审批"/>
                    <sequenceFlow id="flow_split_manager" sourceRef="parallelSplit" targetRef="managerApprovalTask"/>
                    <sequenceFlow id="flow_split_finance" sourceRef="parallelSplit" targetRef="financeApprovalTask"/>
                    <userTask id="managerApprovalTask" name="部门审批" flowable:assignee="${managerApprover}"/>
                    <userTask id="financeApprovalTask" name="财务审批" flowable:assignee="${financeApprover}"/>
                    <sequenceFlow id="flow_manager_join" sourceRef="managerApprovalTask" targetRef="parallelJoin"/>
                    <sequenceFlow id="flow_finance_join" sourceRef="financeApprovalTask" targetRef="parallelJoin"/>
                    <parallelGateway id="parallelJoin" name="审批汇总"/>
                    <sequenceFlow id="flow_join_end" sourceRef="parallelJoin" targetRef="end"/>
                    <endEvent id="end" name="完成"/>
                  </process>
                  <bpmndi:BPMNDiagram id="BPMNDiagram_purchaseApproval">
                    <bpmndi:BPMNPlane id="BPMNPlane_purchaseApproval" bpmnElement="purchaseApproval">
                      <bpmndi:BPMNShape id="Shape_start" bpmnElement="start">
                        <omgdc:Bounds x="80" y="160" width="36" height="36"/>
                      </bpmndi:BPMNShape>
                      <bpmndi:BPMNShape id="Shape_parallelSplit" bpmnElement="parallelSplit" isMarkerVisible="true">
                        <omgdc:Bounds x="170" y="153" width="50" height="50"/>
                      </bpmndi:BPMNShape>
                      <bpmndi:BPMNShape id="Shape_managerApprovalTask" bpmnElement="managerApprovalTask">
                        <omgdc:Bounds x="290" y="80" width="130" height="80"/>
                      </bpmndi:BPMNShape>
                      <bpmndi:BPMNShape id="Shape_financeApprovalTask" bpmnElement="financeApprovalTask">
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
                      <bpmndi:BPMNEdge id="Edge_flow_split_manager" bpmnElement="flow_split_manager">
                        <omgdi:waypoint x="195" y="153"/>
                        <omgdi:waypoint x="195" y="120"/>
                        <omgdi:waypoint x="290" y="120"/>
                      </bpmndi:BPMNEdge>
                      <bpmndi:BPMNEdge id="Edge_flow_split_finance" bpmnElement="flow_split_finance">
                        <omgdi:waypoint x="195" y="203"/>
                        <omgdi:waypoint x="195" y="250"/>
                        <omgdi:waypoint x="290" y="250"/>
                      </bpmndi:BPMNEdge>
                      <bpmndi:BPMNEdge id="Edge_flow_manager_join" bpmnElement="flow_manager_join">
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

    public static String purchaseFormSchema() {
        return """
                {
                  "type": "object",
                  "required": ["applicant", "department", "itemName", "amount", "reason", "managerApprover", "financeApprover"],
                  "properties": {
                    "applicant": {
                      "type": "string",
                      "title": "申请人"
                    },
                    "department": {
                      "type": "string",
                      "title": "申请部门"
                    },
                    "itemName": {
                      "type": "string",
                      "title": "采购内容"
                    },
                    "amount": {
                      "type": "number",
                      "title": "预算金额"
                    },
                    "reason": {
                      "type": "string",
                      "title": "采购原因",
                      "ui:widget": "textarea"
                    },
                    "managerApprover": {
                      "type": "string",
                      "title": "部门审批人"
                    },
                    "financeApprover": {
                      "type": "string",
                      "title": "财务审批人"
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

    public static String purchaseFormUiSchema() {
        return """
                {
                  "reason": {
                    "widget": "textarea"
                  },
                  "remark": {
                    "widget": "textarea"
                  }
                }
                """;
    }
}
