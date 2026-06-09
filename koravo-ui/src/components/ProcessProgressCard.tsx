import { ProCard, ProDescriptions } from '@ant-design/pro-components';
import { Badge, Empty, Flex, Tag, Timeline, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import type { ProcessTrace, ProcessTraceNode, TaskItem } from '@/services/koravo/api';
import { organizationMemberName } from '@/services/koravo/organization';
import {
  businessKeyLabel,
  processDefinitionLabel,
  processStatusLabel,
  taskDefinitionLabel,
} from '@/utils/display';
import { formatDateTime } from '@/utils/format';
import ProcessDiagramViewer from './ProcessDiagramViewer';

interface ProcessProgressCardProps {
  trace?: ProcessTrace;
  currentTasks?: TaskItem[];
  activeTask?: TaskItem;
  loading?: boolean;
}

const useStyles = createStyles(({ css }) => ({
  content: css`
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.75fr);
    gap: 16px;

    @media (max-width: 960px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  side: css`
    min-width: 0;
  `,
}));

function nodeLabel(node?: ProcessTraceNode, fallback?: string) {
  if (!node) return fallback || '-';
  if (node.activityType === 'startEvent') return '开始';
  if (node.activityType === 'endEvent') return '结束';
  return taskDefinitionLabel(node.activityId, { name: node.activityName }) || fallback || node.activityId;
}

function currentNodes(trace?: ProcessTrace, currentTasks: TaskItem[] = []) {
  const currentIds = new Set([
    ...(trace?.currentActivityIds || []),
    ...currentTasks.map((task) => task.taskDefinitionKey).filter(Boolean),
  ]);
  return (trace?.timeline || []).filter((node) => currentIds.has(node.activityId));
}

function latestCompletedNode(trace?: ProcessTrace) {
  return [...(trace?.timeline || [])]
    .reverse()
    .find(
      (node) =>
        node.activityType !== 'sequenceFlow' &&
        String(node.status || '').toUpperCase() === 'COMPLETED',
    );
}

function visibleTimelineNodes(timeline: ProcessTraceNode[]) {
  const nodes = timeline.filter((node) => node.activityType !== 'sequenceFlow');
  return nodes.length ? nodes : timeline;
}

function activityTypeLabel(activityType?: string) {
  const mapping: Record<string, string> = {
    startEvent: '开始',
    endEvent: '结束',
    userTask: '人工任务',
    serviceTask: '系统任务',
    exclusiveGateway: '条件分支',
    parallelGateway: '并行分支',
    inclusiveGateway: '包容分支',
  };
  return mapping[activityType || ''] || activityType || '-';
}

function timelineColor(status?: string) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'COMPLETED') return 'green';
  if (normalized === 'ACTIVE' || normalized === 'RUNNING') return 'blue';
  if (normalized === 'FAILED' || normalized === 'TERMINATED') return 'red';
  return 'gray';
}

function badgeStatus(status?: string) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'COMPLETED') return 'success' as const;
  if (normalized === 'ACTIVE' || normalized === 'RUNNING') return 'processing' as const;
  if (normalized === 'FAILED' || normalized === 'TERMINATED') return 'error' as const;
  if (normalized === 'SUSPENDED') return 'warning' as const;
  return 'default' as const;
}

function buildTimelineItems(timeline: ProcessTraceNode[]) {
  return visibleTimelineNodes(timeline).map((node, index) => ({
    key: `${node.activityId}-${node.startTime || index}`,
    color: timelineColor(node.status),
    content: (
      <Flex vertical gap={2}>
        <Flex align="center" gap={8} wrap>
          <Typography.Text strong>{nodeLabel(node)}</Typography.Text>
          <Tag>{activityTypeLabel(node.activityType)}</Tag>
          <Badge status={badgeStatus(node.status)} text={processStatusLabel(node.status)} />
        </Flex>
        <Typography.Text type="secondary">
          {formatDateTime(node.startTime)}
          {node.endTime ? ` - ${formatDateTime(node.endTime)}` : ''}
        </Typography.Text>
      </Flex>
    ),
  }));
}

const ProcessProgressCard: React.FC<ProcessProgressCardProps> = ({
  trace,
  currentTasks = [],
  activeTask,
  loading,
}) => {
  const { styles } = useStyles();
  const activeNodes = currentNodes(trace, currentTasks);
  const latestDone = latestCompletedNode(trace);
  const pendingTasks = currentTasks.filter((task) => task.status !== 'COMPLETED');
  const currentNodeText =
    activeTask?.taskDefinitionKey
      ? taskDefinitionLabel(activeTask.taskDefinitionKey)
      : activeNodes.map((node) => nodeLabel(node)).filter(Boolean).join('、') || '-';
  const currentHandlerText =
    (activeTask?.assignee ? organizationMemberName(activeTask.assignee) : '') ||
    pendingTasks
      .map((task) => (task.assignee ? organizationMemberName(task.assignee) : '未分配'))
      .filter(Boolean)
      .join('、') ||
    '-';

  return (
    <ProCard
      title="流程进度"
      loading={loading}
      extra={
        <Flex gap={8} wrap>
          <Badge count={pendingTasks.length} showZero />
          <Typography.Text type="secondary">待处理任务</Typography.Text>
        </Flex>
      }
      style={{ marginBottom: 16 }}
    >
      <div className={styles.content}>
        <ProcessDiagramViewer
          bpmnXml={trace?.bpmnXml}
          currentActivityIds={trace?.currentActivityIds}
          timeline={trace?.timeline}
        />
        <Flex vertical gap={16} className={styles.side}>
          <ProDescriptions
            size="small"
            column={1}
            dataSource={{
              processDefinitionId: trace?.processDefinitionId,
              businessKey: businessKeyLabel(trace?.businessKey),
              status: processStatusLabel(trace?.status),
              currentNodeText,
              currentHandlerText,
              latestDone: nodeLabel(latestDone),
            }}
            columns={[
              {
                title: '流程',
                dataIndex: 'processDefinitionId',
                renderText: processDefinitionLabel,
              },
              { title: '业务编号', dataIndex: 'businessKey', copyable: true },
              { title: '实例状态', dataIndex: 'status' },
              { title: '当前节点', dataIndex: 'currentNodeText' },
              { title: '当前处理人', dataIndex: 'currentHandlerText' },
              { title: '最近完成', dataIndex: 'latestDone' },
            ]}
          />
          {pendingTasks.length ? (
            <Flex vertical gap={8}>
              <Typography.Text strong>待办分布</Typography.Text>
              <Flex gap={8} wrap>
                {pendingTasks.map((task) => (
                  <Tag key={task.taskId} color={task.taskId === activeTask?.taskId ? 'processing' : 'default'}>
                    {taskDefinitionLabel(task.taskDefinitionKey)}：
                    {task.assignee ? organizationMemberName(task.assignee) : '未分配'}
                  </Tag>
                ))}
              </Flex>
            </Flex>
          ) : null}
          {trace?.timeline?.length ? (
            <Timeline items={buildTimelineItems(trace.timeline)} />
          ) : (
            <Empty description="暂无执行记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Flex>
      </div>
    </ProCard>
  );
};

export default ProcessProgressCard;
