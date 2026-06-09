import { describe, expect, it } from 'vitest';
import { createDefaultBpmnXml, resolveDesignerXml } from './modelerXml';

describe('ProcessDesigner BPMN XML helpers', () => {
  it('creates an executable BPMN process with a start task and end event', () => {
    const xml = createDefaultBpmnXml('collaborativeApproval', '协同审批流程');

    expect(xml).toContain('id="collaborativeApproval"');
    expect(xml).toContain('name="协同审批流程"');
    expect(xml).toContain('isExecutable="true"');
    expect(xml).toContain('<bpmn:startEvent id="StartEvent_1" name="Start"');
    expect(xml).toContain(
      '<bpmn:userTask id="Task_1" name="提交申请" flowable:assignee="$' +
        '{startUserId}"',
    );
    expect(xml).toContain('<bpmn:endEvent id="EndEvent_1" name="End"');
    expect(xml).toContain('<bpmndi:BPMNDiagram');
  });

  it('escapes XML text in the generated process name', () => {
    const xml = createDefaultBpmnXml('contractFlow', 'A&B <Flow> "Test"');

    expect(xml).toContain('name="A&amp;B &lt;Flow&gt; &quot;Test&quot;"');
  });

  it('normalizes generated BPMN ids for the modeler', () => {
    const xml = createDefaultBpmnXml('123', 'Numeric flow');

    expect(xml).toContain('id="businessFlow123"');
    expect(xml).not.toContain('id="123"');
  });

  it('uses existing renderable XML when present and falls back to a generated diagram when empty', () => {
    const renderableXml = createDefaultBpmnXml('contractFlow', 'Contract flow');

    expect(resolveDesignerXml(renderableXml, 'contractFlow', 'Contract flow')).toBe(
      renderableXml,
    );
    expect(resolveDesignerXml('', 'contractFlow', 'Contract flow')).toContain(
      'id="contractFlow"',
    );
  });

  it('falls back to a generated diagram when XML has no renderable diagram', () => {
    expect(
      resolveDesignerXml('<definitions />', 'contractFlow', 'Contract flow'),
    ).toContain(
      'id="contractFlow"',
    );
  });

  it('falls back to a generated diagram when saved XML is not BPMN', () => {
    const xml = resolveDesignerXml('123', 'brokenFlow', 'Broken flow');

    expect(xml).toContain('<bpmn:definitions');
    expect(xml).toContain('id="brokenFlow"');
  });

  it('upgrades saved user tasks with the default assignee', () => {
    const xml = resolveDesignerXml(
      `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="legacyFlow" isExecutable="true">
    <bpmn:userTask id="Task_1" name="Submit" />
  </bpmn:process>
</bpmn:definitions>`,
      'legacyFlow',
      'Legacy flow',
    );

    expect(xml).toContain('xmlns:flowable="http://flowable.org/bpmn"');
    expect(xml).toContain('flowable:assignee="$' + '{startUserId}"');
  });
});
