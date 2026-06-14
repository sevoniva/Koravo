const XML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};
const DEFAULT_USER_TASK_ASSIGNEE = '$' + '{startUserId}';

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (char) => XML_ESCAPE_MAP[char]);
}

function normalizeBpmnId(value?: string) {
  const normalized = (value?.trim() || 'businessFlow')
    .replace(/[^\w.-]/g, '_')
    .replace(/_+/g, '_');

  if (/^[A-Za-z_]/.test(normalized)) {
    return normalized;
  }
  return `businessFlow${normalized}`;
}

export function createDefaultBpmnXml(modelKey?: string, modelName?: string) {
  const processId = normalizeBpmnId(modelKey);
  const processName = escapeXml(modelName?.trim() || processId);

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:flowable="http://flowable.org/bpmn" id="Definitions_${processId}" targetNamespace="http://koravo.io/bpmn">
  <bpmn:process id="${processId}" name="${processName}" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="开始">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Task_1" name="多人会签" flowable:assignee="\${approvalUser}">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
      <bpmn:multiInstanceLoopCharacteristics isSequential="false" flowable:collection="approvalUsers" flowable:elementVariable="approvalUser" />
    </bpmn:userTask>
    <bpmn:endEvent id="EndEvent_1" name="完成">
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${processId}">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="160" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="260" y="138" width="120" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="460" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="196" y="178" />
        <di:waypoint x="260" y="178" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="380" y="178" />
        <di:waypoint x="460" y="178" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

function isBpmnDefinitionsXml(value: string) {
  return /<([a-zA-Z_][\w.-]*:)?definitions(\s|>)/.test(value);
}

function hasRenderableBpmnDiagram(value: string) {
  return (
    /<([a-zA-Z_][\w.-]*:)?process(\s|>)/.test(value) &&
    /<([a-zA-Z_][\w.-]*:)?BPMNDiagram(\s|>)/.test(value)
  );
}

function ensureFlowableNamespace(xml: string) {
  if (xml.includes('xmlns:flowable=')) {
    return xml;
  }
  return xml.replace(
    /<([a-zA-Z_][\w.-]*:)?definitions\b([^>]*)>/,
    '<$1definitions$2 xmlns:flowable="http://flowable.org/bpmn">',
  );
}

function ensureUserTaskAssignees(xml: string) {
  return xml.replace(
    /<([a-zA-Z_][\w.-]*:)?userTask\b([^>]*)>/g,
    (tag, prefix = '', attributes: string) => {
      if (/\s(?:flowable:)?assignee=/.test(attributes)) {
        return tag;
      }
      const selfClosing = /\/\s*$/.test(attributes);
      const normalizedAttributes = selfClosing
        ? attributes.replace(/\/\s*$/, '').trimEnd()
        : attributes.trimEnd();
      const assignee = ` flowable:assignee="${DEFAULT_USER_TASK_ASSIGNEE}"`;
      const suffix = selfClosing ? ' />' : '>';
      return `<${prefix}userTask${normalizedAttributes}${assignee}${suffix}`;
    },
  );
}

function upgradeBpmnXml(xml: string) {
  const withAssignees = ensureUserTaskAssignees(xml);
  if (withAssignees === xml) {
    return xml;
  }
  return ensureFlowableNamespace(withAssignees);
}

export function resolveDesignerXml(
  bpmnXml?: string,
  modelKey?: string,
  modelName?: string,
) {
  const trimmed = bpmnXml?.trim();
  if (trimmed && isBpmnDefinitionsXml(trimmed) && hasRenderableBpmnDiagram(trimmed)) {
    return upgradeBpmnXml(trimmed);
  }
  return createDefaultBpmnXml(modelKey, modelName);
}
