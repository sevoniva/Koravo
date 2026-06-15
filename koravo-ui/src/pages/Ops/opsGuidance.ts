import type {
  ConnectorExecutionLogItem,
  OpsJobItem,
} from '@/services/koravo/api';
import { connectorExecutionStatusTitle } from '@/utils/connectorExecution';
import { processDefinitionLabel, taskDefinitionLabel } from '@/utils/display';
import { processInstanceDetailPath } from '@/utils/processStartNotice';

export interface OpsGuidanceStep {
  title: string;
  description: string;
}

export interface OpsProcessContextTarget {
  key: 'progress' | 'audit';
  label: string;
  path: string;
}

export function opsProcessProgressPath(processInstanceId: string) {
  return processInstanceDetailPath(processInstanceId);
}

export function opsProcessAuditPath(processInstanceId: string) {
  return `/audit-logs?resourceId=${encodeURIComponent(processInstanceId)}`;
}

export function opsProcessContextTargets(
  processInstanceId?: string | null,
): OpsProcessContextTarget[] {
  if (!processInstanceId) return [];

  return [
    {
      key: 'progress',
      label: '查看进度',
      path: opsProcessProgressPath(processInstanceId),
    },
    {
      key: 'audit',
      label: '查看审计',
      path: opsProcessAuditPath(processInstanceId),
    },
  ];
}

function nodeLabel(job: Pick<OpsJobItem, 'elementName' | 'elementId'>) {
  return job.elementName || taskDefinitionLabel(job.elementId) || '异常节点';
}

export function opsJobGuidanceSteps(
  job: Pick<
    OpsJobItem,
    | 'type'
    | 'retries'
    | 'processInstanceId'
    | 'processDefinitionId'
    | 'elementName'
    | 'elementId'
    | 'exceptionMessage'
  >,
): OpsGuidanceStep[] {
  const processText = job.processInstanceId
    ? `关联流程：${processDefinitionLabel(job.processDefinitionId)}`
    : '未关联流程实例';
  const retryText =
    typeof job.retries === 'number' && job.retries <= 0
      ? '剩余重试为 0，先确认外部依赖或流程配置已经恢复。'
      : '修正原因后可以提交重试。';
  const jobTypeText = job.type === 'DEAD_LETTER' ? '死信任务' : '失败任务';

  return [
    {
      title: '定位影响',
      description: `${processText}，异常节点：${nodeLabel(job)}。`,
    },
    {
      title: '确认原因',
      description: job.exceptionMessage
        ? `先处理异常摘要：${job.exceptionMessage}`
        : `${jobTypeText}没有返回异常摘要，展开诊断明细。`,
    },
    {
      title: '处置结果',
      description: `${retryText}若确认不再需要执行，删除任务并通过审计日志留痕。`,
    },
  ];
}

export function connectorGuidanceSteps(
  log: Pick<
    ConnectorExecutionLogItem,
    'status' | 'statusCode' | 'url' | 'method' | 'errorMessage' | 'requestId'
  >,
): OpsGuidanceStep[] {
  const statusText = connectorExecutionStatusTitle(log.status);
  const requestText = log.requestId ? '已关联业务追踪号' : '缺少业务追踪号';
  const statusCode =
    typeof log.statusCode === 'number'
      ? `状态码 ${log.statusCode}`
      : statusText;

  return [
    {
      title: '核对调用',
      description: `${log.method || '-'} ${log.url || '-'}，${requestText}。`,
    },
    {
      title: '确认响应',
      description: log.errorMessage
        ? `${statusCode}，${log.errorMessage}`
        : `${statusCode}，查看请求和响应摘要。`,
    },
    {
      title: '重试跟踪',
      description: '修正连接器配置或下游服务后重试，再从审计日志跟踪结果。',
    },
  ];
}
