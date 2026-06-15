import { describe, expect, it } from 'vitest';
import type { TaskItem } from '@/services/koravo/api';
import { buildTaskCompletionOutcome } from './completionOutcome';

function task(partial: Partial<TaskItem>): TaskItem {
  return {
    taskId: partial.taskId || 'task-1',
    name: partial.name || '多人会签',
    processInstanceId: partial.processInstanceId || 'instance-1',
    processDefinitionId: partial.processDefinitionId || 'pd-1',
    businessKey: partial.businessKey || 'REQ-1',
    createTime: partial.createTime || '2026-06-15T10:00:00Z',
    assignee: partial.assignee || 'manager',
    taskDefinitionKey: partial.taskDefinitionKey || 'jointApprovalTask',
    status: partial.status || 'RUNNING',
  };
}

describe('buildTaskCompletionOutcome', () => {
  it('points the approver to their next task when one remains assigned to them', () => {
    const current = task({ taskId: 'task-current', assignee: 'manager' });
    const next = task({
      taskId: 'task-next',
      assignee: 'manager',
      taskDefinitionKey: 'financeApprovalTask',
      name: '财务复核',
    });

    const outcome = buildTaskCompletionOutcome(current, [next]);

    expect(outcome.nextTask?.taskId).toBe('task-next');
    expect(outcome.title).toBe('可继续处理');
    expect(outcome.summary).toBe('下一节点：财务复核');
    expect(outcome.nextStep).toBe('你还有待办，继续处理「财务复核」。');
  });

  it('summarizes remaining countersign handlers after one approver completes', () => {
    const current = task({ taskId: 'task-manager', assignee: 'manager' });
    const finance = task({ taskId: 'task-finance', assignee: 'finance' });

    const outcome = buildTaskCompletionOutcome(current, [finance]);

    expect(outcome.title).toBe('会签处理中');
    expect(outcome.summary).toBe('仍有 1 个会签任务待处理。');
    expect(outcome.nextStep).toBe('等待复核专员提交。');
    expect(outcome.remainingTaskSummaries).toEqual([
      {
        taskId: 'task-finance',
        nodeLabel: '多人会签',
        handlerLabel: '复核专员',
        currentUserTask: false,
      },
    ]);
  });

  it('uses the completed state when no current tasks remain', () => {
    const current = task({ taskId: 'task-manager', assignee: 'manager' });

    const outcome = buildTaskCompletionOutcome(current, []);

    expect(outcome.nextTask).toBeUndefined();
    expect(outcome.title).toBe('流程已无当前待办');
    expect(outcome.summary).toBe('流程已无当前待办。');
    expect(outcome.nextStep).toBe('查看实例进度和审批记录。');
    expect(outcome.remainingTaskSummaries).toEqual([]);
  });
});
