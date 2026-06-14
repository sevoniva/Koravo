import { describe, expect, it } from 'vitest';
import { normalizeBpmnImportWarnings } from './bpmnImportWarnings';

describe('normalizeBpmnImportWarnings', () => {
  it('maps unsupported BPMN content to a business-readable warning', () => {
    expect(
      normalizeBpmnImportWarnings([
        new Error(
          'unparsable content <flowable:formProperty id="applyReason" /> detected',
        ),
      ]),
    ).toEqual([
      expect.objectContaining({
        reason: '存在设计器未识别的流程内容',
        location: 'applyReason',
        action: '检查扩展属性或改为标准 BPMN 内容',
      }),
    ]);
  });

  it('uses nested element IDs as the fix location', () => {
    expect(
      normalizeBpmnImportWarnings([
        {
          message: 'duplicate ID detected',
          element: { businessObject: { id: 'jointApprovalTask' } },
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        reason: '节点标识重复',
        location: 'jointApprovalTask',
        action: '修改重复节点标识后重新加载',
      }),
    ]);
  });

  it('marks file-level warnings when no node is available', () => {
    expect(
      normalizeBpmnImportWarnings([
        { error: { message: 'cannot resolve referenced process message' } },
      ]),
    ).toEqual([
      expect.objectContaining({
        reason: '引用的节点或资源不存在',
        location: '流程文件（未返回节点 ID）',
        action: '补齐引用目标或删除失效引用',
      }),
    ]);
  });
});
