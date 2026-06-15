import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TaskItem } from '@/services/koravo/api';
import ProcessContextSummary from './ProcessContextSummary';

function task(partial: Partial<TaskItem>): TaskItem {
  return {
    taskId: partial.taskId || 'task-1',
    name: partial.name || '审批任务',
    processInstanceId: partial.processInstanceId || 'instance-1',
    processDefinitionId: partial.processDefinitionId || 'pd-1',
    businessKey: partial.businessKey || 'REQ-1',
    createTime: partial.createTime || '2026-06-13T10:00:00Z',
    assignee: partial.assignee || '',
    taskDefinitionKey: partial.taskDefinitionKey || 'approvalTask',
    status: partial.status || 'RUNNING',
  };
}

describe('ProcessContextSummary', () => {
  it('summarizes parallel approval tasks with handlers', () => {
    render(
      <ProcessContextSummary
        tasks={[
          task({
            taskId: 'task-manager',
            taskDefinitionKey: 'jointApprovalTask',
            assignee: 'manager',
          }),
          task({
            taskId: 'task-finance',
            taskDefinitionKey: 'jointApprovalTask',
            assignee: 'finance',
          }),
        ]}
      />,
    );

    expect(screen.getByText('多人会签')).toBeInTheDocument();
    expect(screen.getByText('会签 2 人')).toBeInTheDocument();
    expect(screen.getByText('审批主管、复核专员')).toBeInTheDocument();
    expect(screen.getByText('会签审批')).toBeInTheDocument();
  });

  it('keeps parallel nodes distinct from one-node countersign tasks', () => {
    render(
      <ProcessContextSummary
        tasks={[
          task({
            taskId: 'task-manager',
            taskDefinitionKey: 'approvalTask',
            assignee: 'manager',
          }),
          task({
            taskId: 'task-finance',
            taskDefinitionKey: 'financeApprovalTask',
            assignee: 'finance',
          }),
        ]}
      />,
    );

    expect(screen.getByText('审批处理、财务复核')).toBeInTheDocument();
    expect(screen.getByText('并行 2 节点')).toBeInTheDocument();
    expect(screen.getByText('并行审批')).toBeInTheDocument();
  });

  it('shows claim and finished states without raw ids', () => {
    const { rerender } = render(
      <ProcessContextSummary
        tasks={[
          task({
            taskDefinitionKey: 'candidateApprovalTask',
            assignee: '',
          }),
        ]}
      />,
    );

    expect(screen.getByText('未分配')).toBeInTheDocument();
    expect(screen.getByText('待认领')).toBeInTheDocument();

    rerender(<ProcessContextSummary tasks={[]} instanceStatus="COMPLETED" />);

    expect(screen.getByText('流程已结束')).toBeInTheDocument();
    expect(screen.getByText('无待办')).toBeInTheDocument();
    expect(screen.queryByText('candidateApprovalTask')).not.toBeInTheDocument();
  });
});
