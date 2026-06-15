import { describe, expect, it } from 'vitest';
import type { ProcessTraceNode } from '@/services/koravo/api';
import { withProcessTraceRowKeys } from './processTraceRows';

describe('process trace rows', () => {
  it('keeps countersign activity rows unique', () => {
    const parallelNode: ProcessTraceNode = {
      activityId: 'jointApprovalTask',
      activityName: '多人会签',
      activityType: 'userTask',
      startTime: '2026-06-14T07:48:53.592Z',
      status: 'ACTIVE',
    };

    const rows = withProcessTraceRowKeys([parallelNode, parallelNode]);

    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.rowKey)).size).toBe(2);
    expect(rows[0]).toMatchObject(parallelNode);
    expect(rows[1]).toMatchObject(parallelNode);
  });
});
