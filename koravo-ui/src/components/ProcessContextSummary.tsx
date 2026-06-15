import { Badge, Space, Tag, Typography } from 'antd';
import React from 'react';
import type { TaskItem } from '@/services/koravo/api';
import { organizationMemberName } from '@/services/koravo/organization';
import { taskDefinitionLabel } from '@/utils/display';

interface ProcessContextSummaryProps {
  tasks?: TaskItem[];
  activeTask?: TaskItem;
  instanceStatus?: string;
  emptyText?: string;
}

function isCompletedTask(task: TaskItem) {
  return String(task.status || '').toUpperCase() === 'COMPLETED';
}

function uniqueText(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function pendingTasks(tasks: TaskItem[] = [], activeTask?: TaskItem) {
  const pending = tasks.filter((task) => !isCompletedTask(task));
  if (pending.length) return pending;
  return activeTask ? [activeTask] : [];
}

function nodeText(tasks: TaskItem[]) {
  const labels = uniqueText(
    tasks.map((task) => taskDefinitionLabel(task.taskDefinitionKey)),
  );
  return labels.length ? labels.join('、') : '-';
}

function handlerText(tasks: TaskItem[]) {
  const handlers = uniqueText(
    tasks.map((task) =>
      task.assignee ? organizationMemberName(task.assignee) : '未分配',
    ),
  );
  return handlers.length ? handlers.join('、') : '-';
}

function pendingTaskGroupCount(tasks: TaskItem[]) {
  return new Set(
    tasks.map((task) => task.taskDefinitionKey || task.taskId).filter(Boolean),
  ).size;
}

function coordinationText(tasks: TaskItem[]) {
  if (tasks.length <= 1) return undefined;
  const groupCount = pendingTaskGroupCount(tasks);
  if (groupCount <= 1) return `会签 ${tasks.length} 人`;
  return `并行 ${groupCount} 节点`;
}

function isInstanceDone(status?: string) {
  return ['COMPLETED', 'TERMINATED'].includes(String(status || '').toUpperCase());
}

function nextActionText(tasks: TaskItem[], instanceStatus?: string) {
  if (!tasks.length) {
    return isInstanceDone(instanceStatus) ? '无待办' : '待流转';
  }
  if (tasks.some((task) => !task.assignee)) return '待认领';
  if (tasks.length > 1) {
    return pendingTaskGroupCount(tasks) <= 1 ? '会签审批' : '并行审批';
  }
  return isCompletedTask(tasks[0]) ? '已处理' : '待处理';
}

function badgeStatus(tasks: TaskItem[], instanceStatus?: string) {
  if (!tasks.length) {
    return isInstanceDone(instanceStatus) ? 'success' as const : 'default' as const;
  }
  if (tasks.some((task) => !task.assignee)) return 'warning' as const;
  return tasks.every(isCompletedTask) ? 'success' as const : 'processing' as const;
}

const ProcessContextSummary: React.FC<ProcessContextSummaryProps> = ({
  tasks = [],
  activeTask,
  instanceStatus,
  emptyText = '暂无当前节点',
}) => {
  const visibleTasks = pendingTasks(tasks, activeTask);
  const currentNodeText = visibleTasks.length
    ? nodeText(visibleTasks)
    : isInstanceDone(instanceStatus)
      ? '流程已结束'
      : emptyText;
  const currentHandlerText = visibleTasks.length ? handlerText(visibleTasks) : '-';
  const nextText = nextActionText(visibleTasks, instanceStatus);
  const currentCoordinationText = coordinationText(visibleTasks);

  return (
    <Space vertical size={2} style={{ minWidth: 0, width: '100%' }}>
      <Space size={6} wrap>
        <Badge
          status={badgeStatus(visibleTasks, instanceStatus)}
          text={
            <Typography.Text
              strong
              ellipsis={{ tooltip: currentNodeText }}
              style={{ maxWidth: 220 }}
            >
              {currentNodeText}
            </Typography.Text>
          }
        />
        {currentCoordinationText ? (
          <Tag color="processing">{currentCoordinationText}</Tag>
        ) : null}
      </Space>
      <Space size={[4, 4]} wrap>
        {visibleTasks.length ? <Tag>{currentHandlerText}</Tag> : null}
        <Typography.Text type="secondary">{nextText}</Typography.Text>
      </Space>
    </Space>
  );
};

export default ProcessContextSummary;
