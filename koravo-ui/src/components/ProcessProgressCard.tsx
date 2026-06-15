import { ProCard } from '@ant-design/pro-components';
import type { CollapseProps } from 'antd';
import {
  Badge,
  Collapse,
  Empty,
  Flex,
  Progress,
  Space,
  Tag,
  Timeline,
  Typography,
} from 'antd';
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
  processStatusLabel,
  taskDefinitionLabel,
} from '@/utils/display';
import { formatDateTime } from '@/utils/format';
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
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  `,
  statusStrip: css`
    display: grid;
    grid-template-columns: repeat(4, minmax(140px, 1fr));
    gap: 10px 12px;
    padding: 10px 12px;
    background: ${token.colorFillQuaternary};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;

    @media (max-width: 900px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 560px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  progressLine: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    min-width: 0;
    padding: 8px 12px;
    background: ${token.colorFillQuaternary};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;

    @media (max-width: 560px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  actionLine: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px 8px;
    align-items: center;
    min-width: 0;

    .ant-tag {
      margin-inline-end: 0;
    }
  `,
  actionDetail: css`
    min-width: 0;
    word-break: break-word;
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
  details: css`
    .ant-collapse-header {
      padding-inline: 0 !important;
    }

    .ant-collapse-content-box {
      padding-inline: 0 !important;
      padding-bottom: 0 !important;
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
  const currentIds = new Set(progressCurrentActivityIds(trace, currentTasks));
  return (trace?.timeline || []).filter((node) =>
    currentIds.has(node.activityId),
  );
}

function progressCurrentActivityIds(
  trace?: ProcessTrace,
  currentTasks: TaskItem[] = [],
  activeTask?: TaskItem,
) {
  return uniqueText([
    ...(trace?.currentActivityIds || []),
    ...currentTasks.map((task) => task.taskDefinitionKey || ''),
    activeTask?.taskDefinitionKey || '',
  ]);
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

function taskGroupsSummary(
  taskGroups: ReturnType<typeof pendingTaskGroups>,
  pendingTasks: TaskItem[],
) {
  if (!pendingTasks.length) return undefined;
  const jointGroups = taskGroups.filter(
    (group) => group.activeTaskIds.length > 1,
  );
  if (jointGroups.length) {
    return `会签 ${pendingTasks.length} 人`;
  }
  if (pendingTasks.length > 1) return `并行 ${taskGroups.length} 节点`;
  return undefined;
}

function pendingHandlersText(
  taskGroups: ReturnType<typeof pendingTaskGroups>,
  fallback: string,
) {
  if (!taskGroups.length) return fallback;
  if (taskGroups.length === 1)
    return taskGroups[0].handlers.join('、') || fallback;
  return taskGroups
    .map((group) => `${group.label}：${group.handlers.join('、') || '-'}`)
    .join('；');
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

function progressCounts(trace?: ProcessTrace) {
  const nodes = visibleTimelineNodes(trace?.timeline || []);
  const status = String(trace?.status || '').toUpperCase();
  const completedIds = new Set(
    nodes
      .filter(
        (node) => String(node.status || '').toUpperCase() === 'COMPLETED',
      )
      .map((node) => node.activityId)
      .filter(Boolean),
  );
  const total = Math.max(nodes.length, bpmnNodeCount(trace?.bpmnXml));
  const completed =
    total && status === 'COMPLETED'
      ? total
      : total
        ? Math.min(completedIds.size, total)
        : 0;
  return {
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
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

function isCompletedTask(task?: TaskItem) {
  return String(task?.status || '').toUpperCase() === 'COMPLETED';
}

function taskHandlerName(task: TaskItem) {
  return task.assignee ? organizationMemberName(task.assignee) : '未分配';
}

function pendingHandlerNames(pendingTasks: TaskItem[]) {
  return uniqueText(pendingTasks.map(taskHandlerName));
}

function pendingHandlerText(pendingTasks: TaskItem[], fallback: string) {
  const handlers = pendingHandlerNames(pendingTasks);
  return handlers.length ? handlers.join('、') : fallback;
}

function personalProgress(
  trace: ProcessTrace | undefined,
  pendingTasks: TaskItem[],
  activeTask?: TaskItem,
  currentUserId?: string,
) {
  const status = String(trace?.status || '').toUpperCase();
  const pendingText = pendingHandlerText(
    pendingTasks,
    status === 'COMPLETED' || status === 'TERMINATED' ? '无待办' : '待流转',
  );

  if (activeTask) {
    const handler = taskHandlerName(activeTask);
    if (isCompletedTask(activeTask)) {
      return {
        color: 'success',
        label:
          activeTask.assignee && activeTask.assignee === currentUserId
            ? '你已处理'
            : `${handler}已处理`,
        detail: pendingTasks.length ? `还差：${pendingText}` : '无待办',
      };
    }
    if (!activeTask.assignee) {
      return {
        color: 'warning',
        label: '待认领',
        detail: `待处理：${pendingText}`,
      };
    }
    if (activeTask.assignee === currentUserId) {
      return {
        color: 'processing',
        label: '待你处理',
        detail:
          pendingTasks.length > 1 ? `同节点：${pendingText}` : '提交后流转',
      };
    }
    return {
      color: 'default',
      label: `待${handler}`,
      detail: `待处理：${pendingText}`,
    };
  }

  if (pendingTasks.some((task) => task.assignee === currentUserId)) {
    return {
      color: 'processing',
      label: '待你处理',
      detail: pendingTasks.length > 1 ? `同节点：${pendingText}` : '提交后流转',
    };
  }
  if (pendingTasks.some((task) => !task.assignee)) {
    return {
      color: 'warning',
      label: '待认领',
      detail: `待处理：${pendingText}`,
    };
  }
  if (pendingTasks.length) {
    return {
      color: 'default',
      label: '等待处理',
      detail: `待处理：${pendingText}`,
    };
  }
  if (status === 'COMPLETED') {
    return { color: 'success', label: '已结束', detail: '无待办' };
  }
  if (status === 'TERMINATED') {
    return { color: 'error', label: '已终止', detail: '无待办' };
  }
  if (status === 'SUSPENDED') {
    return { color: 'warning', label: '已挂起', detail: '待恢复' };
  }
  return { color: 'default', label: '待流转', detail: '等待任务生成' };
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
  taskGroups: ReturnType<typeof pendingTaskGroups>,
  activeTask?: TaskItem,
  currentUserId?: string,
) {
  const status = String(trace?.status || '').toUpperCase();
  if (status === 'COMPLETED') return '无待办';
  if (status === 'TERMINATED') return '已终止';
  if (status === 'SUSPENDED') return '待恢复';
  if (!pendingTasks.length) return '待流转';
  if (activeTask && !isCompletedTask(activeTask)) {
    const assignee = String(activeTask.assignee || '').trim();
    if (!assignee) return '待认领';
    return assignee === currentUserId ? '待你处理' : '处理中';
  }
  const jointGroup = taskGroups.find((group) => group.activeTaskIds.length > 1);
  if (jointGroup) return '会签中';
  if (pendingTasks.length > 1) return '并行审批';
  const task = pendingTasks[0];
  return task.assignee ? '处理中' : '待认领';
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
  if (nodeCount > 32) return 380;
  if (nodeCount > 24) return 340;
  if (nodeCount > 14) return 300;
  return 260;
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
  const resolvedCurrentTasks = currentTasks.length
    ? currentTasks
    : trace?.currentTasks || [];
  const activeNodes = currentNodes(trace, resolvedCurrentTasks);
  const pendingTasks = resolvedCurrentTasks.filter(
    (task) => !isCompletedTask(task),
  );
  const isCompleted = String(trace?.status || '').toUpperCase() === 'COMPLETED';
  const rawNodeText = currentNodeText(activeTask, activeNodes);
  const nodeText = isCompleted && rawNodeText === '-' ? '结束' : rawNodeText;
  const currentHandlerText = isCompleted
    ? '无'
    : handlerText(activeTask, pendingTasks);
  const activeTaskCompleted = isCompletedTask(activeTask);
  const activeTaskOwned = Boolean(
    activeTask?.assignee && activeTask.assignee === currentUserId,
  );
  const taskGroups = pendingTaskGroups(pendingTasks, trace);
  const groupSummary = taskGroupsSummary(taskGroups, pendingTasks);
  const pendingLabel = isCompleted
    ? '已完成'
    : activeTask
      ? activeTaskCompleted
        ? '已完成'
        : activeTaskOwned
          ? '待你处理'
          : '查看中'
      : groupSummary ||
        (pendingTasks.length ? `待办 ${pendingTasks.length}` : '无待办');
  const nextStep = nextStepText(
    trace,
    pendingTasks,
    taskGroups,
    activeTask,
    currentUserId,
  );
  const personal = personalProgress(
    trace,
    pendingTasks,
    activeTask,
    currentUserId,
  );
  const timeline = trace?.timeline || [];
  const hasTimeline = timeline.length > 0;
  const handlerMetric = pendingHandlersText(taskGroups, currentHandlerText);
  const counts = progressCounts(trace);
  const progressText = counts.total
    ? `${counts.completed}/${counts.total} 节点`
    : '暂无节点';
  const detailItems: CollapseProps['items'] = [];
  if (taskGroups.length) {
    detailItems.push({
      key: 'pending',
      label: (
        <Space size={8}>
          <Typography.Text strong>当前待办</Typography.Text>
          <Badge count={taskGroups.length} showZero={false} />
        </Space>
      ),
      children: (
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
              {group.activeTaskIds.length > 1
                ? ` · 会签 ${group.activeTaskIds.length} 人`
                : ''}
            </Tag>
          ))}
        </div>
      ),
    });
  }
  if (hasTimeline) {
    detailItems.push({
      key: 'timeline',
      label: (
        <Space size={8}>
          <Typography.Text strong>流转记录</Typography.Text>
          <Badge count={recentTimelineNodes(timeline).length} />
        </Space>
      ),
      children: (
        <div className={styles.timelineWrap}>
          <Timeline items={buildTimelineItems(timeline)} />
        </div>
      ),
    });
  }

  return (
    <ProCard
      title="审批进度"
      loading={loading}
      extra={
        <Space size={8} wrap>
          <Badge
            status={badgeStatus(trace?.status)}
            text={processStatusLabel(trace?.status)}
          />
          <Tag color="blue">{progressText}</Tag>
          <Tag>{pendingLabel}</Tag>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <div className={styles.content}>
        <div className={styles.statusStrip}>
          <Metric
            label="业务对象"
            value={businessKeyLabel(trace?.businessKey)}
          />
          <Metric label="当前节点" value={nodeText} />
          <Metric
            label={groupSummary ? '当前待办' : '办理人'}
            value={handlerMetric}
          />
          <Metric label="下一步" value={nextStep} />
        </div>
        <div className={styles.progressLine}>
          <Progress
            percent={counts.percent}
            showInfo={false}
            size="small"
            status={
              String(trace?.status || '').toUpperCase() === 'TERMINATED'
                ? 'exception'
                : undefined
            }
          />
          <Typography.Text type="secondary">{progressText}</Typography.Text>
        </div>
        <div className={styles.actionLine}>
          <Tag color={personal.color}>{personal.label}</Tag>
          <Typography.Text type="secondary" className={styles.actionDetail}>
            {personal.detail}
          </Typography.Text>
        </div>
        <ProcessDiagramViewer
          bpmnXml={trace?.bpmnXml}
          currentActivityIds={progressCurrentActivityIds(
            trace,
            resolvedCurrentTasks,
            activeTask,
          )}
          showStatusOverlay={false}
          timeline={trace?.timeline}
          height={diagramHeight(trace)}
        />
        {detailItems.length ? (
          <Collapse
            className={styles.details}
            defaultActiveKey={taskGroups.length ? ['pending'] : undefined}
            ghost
            items={detailItems}
            size="small"
          />
        ) : (
          <Empty description="暂无记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </div>
    </ProCard>
  );
};

export default ProcessProgressCard;
