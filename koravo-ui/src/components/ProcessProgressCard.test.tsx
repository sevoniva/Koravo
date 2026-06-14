import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProcessTrace, TaskItem } from '@/services/koravo/api';
import ProcessProgressCard from './ProcessProgressCard';

vi.mock('@ant-design/pro-components', async () => {
  const React = await import('react');
  return {
    ProCard: ({
      title,
      extra,
      children,
    }: {
      title?: React.ReactNode;
      extra?: React.ReactNode;
      children?: React.ReactNode;
    }) =>
      React.createElement(
        'section',
        {},
        React.createElement('header', {}, title, extra),
        children,
      ),
  };
});

vi.mock('./ProcessDiagramViewer', () => ({
  default: () => <div data-testid="process-diagram-viewer" />,
}));

function task(partial: Partial<TaskItem>): TaskItem {
  return {
    taskId: partial.taskId || 'task-1',
    name: partial.name || '审批任务',
    processInstanceId: partial.processInstanceId || 'instance-1',
    processDefinitionId: partial.processDefinitionId || 'pd-1',
    businessKey: partial.businessKey || 'REQ-1',
    createTime: partial.createTime || '2026-06-13T10:00:00Z',
    assignee: partial.assignee || '',
    taskDefinitionKey: partial.taskDefinitionKey || 'jointApprovalTask',
    status: partial.status || 'RUNNING',
  };
}

const trace: ProcessTrace = {
  instanceId: 'instance-1',
  processDefinitionId: 'pd-1',
  businessKey: 'REQ-1',
  status: 'RUNNING',
  variables: {},
  currentActivityIds: ['jointApprovalTask'],
  currentTasks: [],
  timeline: [
    {
      activityId: 'start',
      activityName: '开始',
      activityType: 'startEvent',
      startTime: '2026-06-13T09:00:00Z',
      endTime: '2026-06-13T09:01:00Z',
      status: 'COMPLETED',
    },
    {
      activityId: 'jointApprovalTask',
      activityName: '多人会签',
      activityType: 'userTask',
      startTime: '2026-06-13T09:01:00Z',
      status: 'ACTIVE',
    },
  ],
};

describe('ProcessProgressCard', () => {
  it('makes parallel approval ownership explicit', () => {
    render(
      <ProcessProgressCard
        trace={trace}
        currentTasks={[
          task({ taskId: 'task-manager', assignee: 'manager' }),
          task({ taskId: 'task-finance', assignee: 'finance' }),
        ]}
      />,
    );

    expect(screen.getByTestId('process-diagram-viewer')).toBeInTheDocument();
    expect(screen.getByText('会签 2 人')).toBeInTheDocument();
    expect(screen.getByText('审批主管、复核专员')).toBeInTheDocument();
    expect(screen.getByText('待审批主管、复核专员会签')).toBeInTheDocument();
    expect(
      screen.getByText('多人会签 · 审批主管、复核专员 · 会签 2 人'),
    ).toBeInTheDocument();
  });
});
