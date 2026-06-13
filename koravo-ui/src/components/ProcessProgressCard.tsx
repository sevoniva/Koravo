import { ProCard } from '@ant-design/pro-components';
import { Badge, Empty, Flex, Space, Tag, Timeline, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import type {
  ProcessTrace,
  ProcessTraceNode,
  TaskItem,
} from '@/services/koravo/api';
import { organizationMemberName } from '@/services/koravo/organization';
import {
  businessKeyLabel,
  processDefinitionLabel,
  processStatusLabel,
  taskDefinitionLabel,
} from '@/utils/display';
import { formatDateTime } from '@/utils/format';
import { taskHandlingInstruction } from '@/utils/taskAccess';
import ProcessDiagramViewer from './ProcessDiagramViewer';

interface ProcessProgressCardProps {
  trace?: ProcessTrace;
  currentTasks?: TaskItem[];
  activeTask?: TaskItem;
  currentUserId?: string;
  loading?: boolean;
}

const useStyles = createStyles(({ css, token }) => ({
  content: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    align-items: start;

    @media (min-width: 1080px) {
      grid-template-columns: minmax(560px, 1.5fr) minmax(280px, 0.5fr);
    }
  `,
  side: css`
    min-width: 0;
  `,
  contextLine: css`
    padding-bottom: 10px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
  `,
  contextTitle: css`
    display: block;
    max-width: 280px;
  `,
  contextMeta: css`
    display: block;
    max-width: 280px;
  `,
  statusStrip: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 12px;

    @media (max-width: 520px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  metric: css`
    min-width: 0;
  `,
  metricLabel: css`
    margin-bottom: 2px;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
  `,
  metricValue: css`
    min-width: 0;
    color: ${token.colorText};
    font-weight: ${token.fontWeightStrong};
    line-height: 1.45;
    word-break: break-word;
  `,
  timelineWrap: css`
    max-height: 190px;
    overflow: auto;
    padding-right: 4px;
  `,
  pendingList: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    .ant-tag {
      max-width: 100%;
      margin-inline-end: 0;
      white-space: normal;
      line-height: 1.45;
    }
  `,
}));

function nodeLabel(node?: ProcessTraceNode, fallback?: string) {
  if (!node) return fallback || '-';
  if (node.activityType === 'startEvent') return '开始';
  if (node.activityType === 'endEvent') return '结束';
  return (
    taskDefinitionLabel(node.activityId, { name: node.activityName }) ||
    fallback ||
    node.activityId
  );
}

function currentNodes(trace?: ProcessTrace, currentTasks: TaskItem[] = []) {
  const currentIds = new Set([
    ...(trace?.currentActivityIds || []),
    ...currentTasks.map((task) => task.taskDefinitionKey).filter(Boolean),
  ]);
  return (trace?.timeline || []).filter((node) =>
    currentIds.has(node.activityId),
  );
}

function uniqueText(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function currentNodeText(
  activeTask: TaskItem | undefined,
  activeNodes: ProcessTraceNode[],
) {
  if (activeTask?.taskDefinitionKey) {
    const activeNode = activeNodes.find(
      (node) => node.activityId === activeTask.taskDefinitionKey,
    );
    if (activeNode) {
      return nodeLabel(
        activeNode,
        taskDefinitionLabel(activeTask.taskDefinitionKey, {
          name: activeTask.name,
        }),
      );
    }
  }
  const labels = uniqueText(activeNodes.map((node) => nodeLabel(node)));
  if (labels.length) return labels.join('、');
  if (activeTask?.taskDefinitionKey) {
    return taskDefinitionLabel(activeTask.taskDefinitionKey, {
      name: activeTask.name,
    });
  }
  return '-';
}

function handlerText(
  activeTask: TaskItem | undefined,
  pendingTasks: TaskItem[],
) {
  if (activeTask?.assignee) return organizationMemberName(activeTask.assignee);
  const handlers = uniqueText(
    pendingTasks.map((task) =>
      task.assignee ? organizationMemberName(task.assignee) : '未分配',
    ),
  );
  return handlers.length ? handlers.join('、') : '-';
}

function latestCompletedNode(trace?: ProcessTrace) {
  const completed = (trace?.timeline || []).filter(
    (node) =>
      node.activityType !== 'sequenceFlow' &&
      String(node.status || '').toUpperCase() === 'COMPLETED',
  );
  const businessNodes = completed.filter(
    (node) => node.activityType !== 'startEvent',
  );
  return [...(businessNodes.length ? businessNodes : completed)].sort(
    (left, right) => activityTime(right) - activityTime(left),
  )[0];
}

function activityTime(node: ProcessTraceNode) {
  return Date.parse(node.endTime || node.startTime || '') || 0;
}

function visibleTimelineNodes(timeline: ProcessTraceNode[]) {
  const nodes = timeline.filter((node) => node.activityType !== 'sequenceFlow');
  return nodes.length ? nodes : timeline;
}

function recentTimelineNodes(timeline: ProcessTraceNode[], limit = 5) {
  const seen = new Set<string>();
  const nodes = visibleTimelineNodes(timeline).filter((node) => {
    const key = node.endTime
      ? [node.activityId, node.status, node.startTime, node.endTime].join('|')
      : [node.activityId, node.status, 'active'].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return nodes
    .filter((node) => node.activityType !== 'endEvent')
    .slice(-limit)
    .reverse();
}

function bpmnNodeCount(bpmnXml?: string) {
  if (!bpmnXml || typeof DOMParser === 'undefined') return 0;
  try {
    const document = new DOMParser().parseFromString(
      bpmnXml,
      'application/xml',
    );
    if (document.querySelector('parsererror')) return 0;
    const activityTypes = new Set([
      'startEvent',
      'endEvent',
      'userTask',
      'serviceTask',
      'exclusiveGateway',
      'parallelGateway',
      'inclusiveGateway',
      'subProcess',
      'callActivity',
    ]);
    return Array.from(document.getElementsByTagName('*')).filter((element) =>
      activityTypes.has(element.localName),
    ).length;
  } catch {
    return 0;
  }
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
  if (normalized === 'ACTIVE' || normalized === 'RUNNING')
    return 'processing' as const;
  if (normalized === 'FAILED' || normalized === 'TERMINATED')
    return 'error' as const;
  if (normalized === 'SUSPENDED') return 'warning' as const;
  return 'default' as const;
}

function buildTimelineItems(timeline: ProcessTraceNode[]) {
  return recentTimelineNodes(timeline).map((node, index) => ({
    key: `${node.activityId}-${node.startTime || index}`,
    color: timelineColor(node.status),
    content: (
      <Flex vertical gap={2}>
        <Flex align="center" gap={8} wrap>
          <Typography.Text strong>{nodeLabel(node)}</Typography.Text>
          <Badge
            status={badgeStatus(node.status)}
            text={processStatusLabel(node.status)}
          />
        </Flex>
        <Typography.Text type="secondary">
          {formatDateTime(node.startTime)}
          {node.endTime ? ` - ${formatDateTime(node.endTime)}` : ''}
        </Typography.Text>
      </Flex>
    ),
  }));
}

function nextStepText(
  trace: ProcessTrace | undefined,
  pendingTasks: TaskItem[],
  activeTask?: TaskItem,
  currentUserId?: string,
) {
  const status = String(trace?.status || '').toUpperCase();
  if (status === 'COMPLETED') return '无待办';
  if (status === 'TERMINATED') return '已终止';
  if (status === 'SUSPENDED') return '等待恢复';
  if (!pendingTasks.length) return '等待流转';
  if (activeTask && activeTask.status !== 'COMPLETED') {
    return taskHandlingInstruction({
      task: activeTask,
      currentUserId,
      hasForm: true,
    });
  }
  if (pendingTasks.length > 1) return `并行待办 ${pendingTasks.length}`;
  const task = pendingTasks[0];
  return task.assignee
    ? `待${organizationMemberName(task.assignee)}处理`
    : '等待认领';
}

function taskNodeLabel(task: TaskItem, trace?: ProcessTrace) {
  const node = (trace?.timeline || []).find(
    (item) => item.activityId === task.taskDefinitionKey,
  );
  return nodeLabel(
    node,
    taskDefinitionLabel(task.taskDefinitionKey, { name: task.name }),
  );
}

function pendingTaskGroups(tasks: TaskItem[], trace?: ProcessTrace) {
  const groups = new Map<
    string,
    { key: string; label: string; handlers: string[]; activeTaskIds: string[] }
  >();

  tasks.forEach((task) => {
    const key = task.taskDefinitionKey || task.taskId;
    const label = taskNodeLabel(task, trace);
    const current = groups.get(key) || {
      key,
      label,
      handlers: [],
      activeTaskIds: [],
    };
    current.handlers.push(
      task.assignee ? organizationMemberName(task.assignee) : '未分配',
    );
    current.activeTaskIds.push(task.taskId);
    groups.set(key, current);
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    handlers: uniqueText(group.handlers),
  }));
}

function diagramHeight(trace?: ProcessTrace) {
  const nodeCount = Math.max(
    visibleTimelineNodes(trace?.timeline || []).length,
    bpmnNodeCount(trace?.bpmnXml),
  );
  if (nodeCount > 32) return 640;
  if (nodeCount > 24) return 560;
  if (nodeCount > 14) return 480;
  return 380;
}

const Metric: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => {
  const { styles } = useStyles();
  return (
    <div className={styles.metric}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value || '-'}</div>
    </div>
  );
};

const ProcessProgressCard: React.FC<ProcessProgressCardProps> = ({
  trace,
  currentTasks = [],
  activeTask,
  currentUserId,
  loading,
}) => {
  const { styles } = useStyles();
  const activeNodes = currentNodes(trace, currentTasks);
  const latestDone = latestCompletedNode(trace);
  const pendingTasks = currentTasks.filter(
    (task) => task.status !== 'COMPLETED',
  );
  const nodeText = currentNodeText(activeTask, activeNodes);
  const currentHandlerText = handlerText(activeTask, pendingTasks);
  const isCompleted = String(trace?.status || '').toUpperCase() === 'COMPLETED';
  const activeTaskOwned = Boolean(
    activeTask?.assignee && activeTask.assignee === currentUserId,
  );
  const pendingLabel = isCompleted
    ? '已完成'
    : activeTask
      ? activeTaskOwned
        ? '待你处理'
        : '当前查看'
      : `待办 ${pendingTasks.length}`;
  const nextStep = nextStepText(trace, pendingTasks, activeTask, currentUserId);
  const timeline = trace?.timeline || [];
  const hasTimeline = timeline.length > 0;
  const taskGroups = pendingTaskGroups(pendingTasks, trace);

  return (
    <ProCard
      title="流程进度"
      loading={loading}
      extra={
        <Flex gap={8} wrap>
          <Badge status={badgeStatus(trace?.status)} />
          <Typography.Text type="secondary">{pendingLabel}</Typography.Text>
        </Flex>
      }
      style={{ marginBottom: 16 }}
    >
      <div className={styles.content}>
        <ProcessDiagramViewer
          bpmnXml={trace?.bpmnXml}
          currentActivityIds={trace?.currentActivityIds}
          timeline={trace?.timeline}
          height={diagramHeight(trace)}
        />
        <Flex vertical gap={16} className={styles.side}>
          <Flex
            align="center"
            className={styles.contextLine}
            gap={8}
            justify="space-between"
            wrap
          >
            <Space size={6} wrap>
              <Typography.Text
                strong
                className={styles.contextTitle}
                ellipsis={{ tooltip: processDefinitionLabel(trace?.processDefinitionId) }}
              >
                {processDefinitionLabel(trace?.processDefinitionId)}
              </Typography.Text>
              <Typography.Text
                type="secondary"
                className={styles.contextMeta}
                ellipsis={{ tooltip: businessKeyLabel(trace?.businessKey) }}
              >
                {businessKeyLabel(trace?.businessKey)}
              </Typography.Text>
            </Space>
            <Badge
              status={badgeStatus(trace?.status)}
              text={processStatusLabel(trace?.status)}
            />
          </Flex>
          <div className={styles.statusStrip}>
            <Metric label="节点" value={nodeText} />
            <Metric label="处理人" value={currentHandlerText} />
            <Metric label="动作" value={nextStep} />
            <Metric label="上一步" value={nodeLabel(latestDone)} />
          </div>
          {taskGroups.length ? (
            <Flex vertical gap={8}>
              <Typography.Text strong>待办</Typography.Text>
              <div className={styles.pendingList}>
                {taskGroups.map((group) => (
                  <Tag
                    key={group.key}
                    color={
                      group.activeTaskIds.includes(activeTask?.taskId || '')
                        ? 'processing'
                        : 'default'
                    }
                  >
                    {group.label} · {group.handlers.join('、')}
                  </Tag>
                ))}
              </div>
            </Flex>
          ) : null}
          {hasTimeline ? (
            <Flex vertical gap={8}>
              <Typography.Text strong>最近记录</Typography.Text>
              <div className={styles.timelineWrap}>
                <Timeline items={buildTimelineItems(timeline)} />
              </div>
            </Flex>
          ) : (
            <Empty
              description="暂无记录"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </Flex>
      </div>
    </ProCard>
  );
};

export default ProcessProgressCard;
