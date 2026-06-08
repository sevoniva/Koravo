import { describe, expect, it } from 'vitest';
import { createDefaultBpmnXml, resolveDesignerXml } from './modelerXml';

describe('ProcessDesigner BPMN XML helpers', () => {
  it('creates an executable BPMN process with a start task and end event', () => {
    const xml = createDefaultBpmnXml('leaveApproval', 'Leave approval');

    expect(xml).toContain('id="leaveApproval"');
    expect(xml).toContain('name="Leave approval"');
    expect(xml).toContain('isExecutable="true"');
    expect(xml).toContain('<bpmn:startEvent id="StartEvent_1" name="Start"');
    expect(xml).toContain(
      '<bpmn:userTask id="Task_1" name="Submit" flowable:assignee="$' +
        '{startUserId}"',
    );
    expect(xml).toContain('<bpmn:endEvent id="EndEvent_1" name="End"');
    expect(xml).toContain('<bpmndi:BPMNDiagram');
  });

  it('escapes XML text in the generated process name', () => {
    const xml = createDefaultBpmnXml('contractFlow', 'A&B <Flow> "Test"');

    expect(xml).toContain('name="A&amp;B &lt;Flow&gt; &quot;Test&quot;"');
  });

  it('uses existing XML when present and falls back to a generated diagram when empty', () => {
    expect(
      resolveDesignerXml('<definitions />', 'contractFlow', 'Contract flow'),
    ).toBe('<definitions />');
    expect(resolveDesignerXml('', 'contractFlow', 'Contract flow')).toContain(
      'id="contractFlow"',
    );
  });
});
