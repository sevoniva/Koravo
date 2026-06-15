import { describe, expect, it } from 'vitest';
import type { TaskItem } from '@/services/koravo/api';
import {
  isStartSuccessRedirect,
  processInstanceDetailPath,
  startSuccessDescription,
} from './processStartNotice';

function task(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    taskId: 'task-1',
    name: '多人会签',
    processInstanceId: 'instance-1',
    processDefinitionId: 'collaborativeApproval:1:pd',
    businessKey: 'REQ-1',
    createTime: '2026-01-01T00:00:00Z',
    assignee: 'manager',
    taskDefinitionKey: 'jointApprovalTask',
    status: 'RUNNING',
    ...overrides,
  };
}

describe('process start notice helpers', () => {
  it('marks detail redirects that come from a new start', () => {
    expect(processInstanceDetailPath('instance-1', { started: true })).toBe(
      '/process-instances/instance-1?started=1',
    );
    expect(isStartSuccessRedirect('?started=1')).toBe(true);
    expect(isStartSuccessRedirect('?started=0')).toBe(false);
  });

  it('summarizes countersign approval tasks with organization names', () => {
    expect(
      startSuccessDescription([
        task({ assignee: 'manager' }),
        task({ taskId: 'task-2', assignee: 'finance' }),
      ]),
    ).toBe('多人会签已生成 2 个会签待办：审批主管、复核专员');
  });

  it('keeps true parallel task nodes separate in start notices', () => {
    expect(
      startSuccessDescription([
        task({
          assignee: 'manager',
          taskDefinitionKey: 'approvalTask',
        }),
        task({
          taskId: 'task-2',
          assignee: 'finance',
          taskDefinitionKey: 'financeApprovalTask',
        }),
      ]),
    ).toBe('审批处理、财务复核已生成 2 个并行待办：审批主管、复核专员');
  });

  it('keeps completed tasks out of the next-step notice', () => {
    expect(
      startSuccessDescription([
        task({ status: 'COMPLETED' }),
        task({ taskId: 'task-2', assignee: 'finance' }),
      ]),
    ).toBe('多人会签待复核专员处理');
  });
});
