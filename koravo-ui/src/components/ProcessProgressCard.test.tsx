import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProcessTrace, TaskItem } from '@/services/koravo/api';
import ProcessProgressCard from './ProcessProgressCard';

const processDiagramViewerMock = vi.hoisted(() =>
  vi.fn((props: { viewMode?: string; height?: number }) => (
    <div
      data-height={props.height}
      data-testid="process-diagram-viewer"
      data-view-mode={props.viewMode || 'bpmn'}
    />
  )),
);

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
  default: processDiagramViewerMock,
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
  it('makes countersign ownership explicit', () => {
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
    expect(screen.getByTestId('process-diagram-viewer')).toHaveAttribute(
      'data-view-mode',
      'bpmn',
    );
    expect(screen.getByTestId('process-diagram-viewer')).toHaveAttribute(
      'data-height',
      '260',
    );
    expect(screen.getByText('审批进度')).toBeInTheDocument();
    expect(screen.queryByText('审批上下文')).not.toBeInTheDocument();
    expect(screen.getAllByText('1/2 节点').length).toBeGreaterThan(0);
    expect(screen.getByText('下一步')).toBeInTheDocument();
    expect(screen.queryByText('处理状态')).not.toBeInTheDocument();
    expect(screen.getByText('会签 2 人')).toBeInTheDocument();
    expect(screen.getByText('审批主管、复核专员')).toBeInTheDocument();
    expect(screen.getByText('会签中')).toBeInTheDocument();
    expect(
      screen.getByText('多人会签 · 审批主管、复核专员 · 会签 2 人'),
    ).toBeInTheDocument();
  });

  it('does not mark a completed active task as pending for the current user', () => {
    render(
      <ProcessProgressCard
        trace={trace}
        currentUserId="manager"
        activeTask={task({
          taskId: 'task-manager',
          assignee: 'manager',
          status: 'COMPLETED',
        })}
        currentTasks={[task({ taskId: 'task-finance', assignee: 'finance' })]}
      />,
    );

    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.queryByText('待你处理')).not.toBeInTheDocument();
    expect(screen.getByText('复核专员')).toBeInTheDocument();
    expect(screen.getByText('处理中')).toBeInTheDocument();
  });

  it('shows the end state instead of an empty current node after completion', () => {
    render(
      <ProcessProgressCard
        trace={{
          ...trace,
          status: 'COMPLETED',
          currentActivityIds: [],
          timeline: [
            ...trace.timeline,
            {
              activityId: 'end',
              activityName: '完成',
              activityType: 'endEvent',
              startTime: '2026-06-13T09:10:00Z',
              endTime: '2026-06-13T09:10:00Z',
              status: 'COMPLETED',
            },
          ],
        }}
        currentTasks={[]}
      />,
    );

    expect(screen.getByText('结束')).toBeInTheDocument();
    expect(screen.getByText('无待办')).toBeInTheDocument();
    expect(screen.getAllByText('3/3 节点').length).toBeGreaterThan(0);
    expect(screen.queryByText('当前节点')).toBeInTheDocument();
  });
});
