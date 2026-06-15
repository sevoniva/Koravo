import { describe, expect, it } from 'vitest';
import {
  connectorGuidanceSteps,
  opsJobGuidanceSteps,
  opsProcessAuditPath,
  opsProcessContextTargets,
  opsProcessProgressPath,
} from './opsGuidance';

describe('opsGuidanceSteps', () => {
  it('guides operators through failed workflow jobs without raw ids first', () => {
    const steps = opsJobGuidanceSteps({
      type: 'FAILED',
      retries: 0,
      processInstanceId: '62738d33-678f-11f1-9bb0-6eaa56961236',
      processDefinitionId: 'collaborativeApproval:2:definition',
      elementName: '多人会签',
      elementId: 'jointApprovalTask',
      exceptionMessage: '外部服务超时',
    });

    expect(steps).toHaveLength(3);
    expect(steps[0].description).toContain('协同审批流程 v2');
    expect(steps[0].description).toContain('多人会签');
    expect(steps[1].description).toContain('外部服务超时');
    expect(steps[2].description).toContain('剩余重试为 0');
  });

  it('guides connector failures through request, response, and retry tracking', () => {
    const steps = connectorGuidanceSteps({
      status: 'FAILED',
      statusCode: 502,
      method: 'POST',
      url: 'https://api.example.com/workflow/callback',
      errorMessage: 'Bad Gateway',
      requestId: 'REQ-123',
    });

    expect(steps.map((step) => step.title)).toEqual([
      '核对调用',
      '确认响应',
      '重试跟踪',
    ]);
    expect(steps[0].description).toContain('POST');
    expect(steps[1].description).toContain('状态码 502');
    expect(steps[2].description).toContain('审计日志');
  });

  it('builds stable process context targets for ops pages', () => {
    expect(opsProcessContextTargets()).toEqual([]);
    expect(opsProcessProgressPath('process/1')).toBe(
      '/process-instances/process%2F1',
    );
    expect(opsProcessAuditPath('process/1')).toBe(
      '/audit-logs?resourceId=process%2F1',
    );
    expect(opsProcessContextTargets('process-1')).toEqual([
      {
        key: 'progress',
        label: '查看进度',
        path: '/process-instances/process-1',
      },
      {
        key: 'audit',
        label: '查看审计',
        path: '/audit-logs?resourceId=process-1',
      },
    ]);
  });
});
