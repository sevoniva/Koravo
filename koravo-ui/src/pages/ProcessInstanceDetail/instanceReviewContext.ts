import type {
  AuditLogItem,
  FormSnapshotItem,
  JsonRecord,
  TaskCommentItem,
  TaskDetail,
} from '@/services/koravo/api';
import { organizationMemberName } from '@/services/koravo/organization';
import {
  auditActionLabel,
  businessFieldLabel,
  taskDefinitionLabel,
} from '@/utils/display';
import { parseJsonSafe } from '@/utils/format';

export interface InstanceReviewItem {
  id: string;
  taskId?: string;
  nodeLabel: string;
  handlerLabel: string;
  resultLabel: string;
  resultStatus: 'success' | 'error' | 'warning' | 'processing' | 'default';
  opinion?: string;
  time?: string;
  source: 'snapshot' | 'audit' | 'comment';
}

export function formSnapshotData(record: FormSnapshotItem) {
  return parseJsonSafe<JsonRecord>(record.dataJson, {}) as JsonRecord;
}

function firstText(...values: unknown[]) {
  return values
    .find(
      (value): value is string =>
        typeof value === 'string' && Boolean(value.trim()),
    )
    ?.trim();
}

function reviewOpinion(data: JsonRecord) {
  return firstText(
    data.opinion,
    data.reviewComment,
    data.approvalComment,
    data.comment,
    data.message,
    data.reason,
  );
}

function handlerDisplayName(value?: string) {
  if (!value) return undefined;
  const label = organizationMemberName(value);
  if (label === '待同步成员' && /[\u4e00-\u9fa5]/.test(value)) return value;
  return label;
}

function reviewHandler(
  data: JsonRecord,
  fallbackUserId?: string,
  fallbackLabel?: string,
) {
  const value = firstText(
    data.userId,
    data.handlerUserId,
    data.handler,
    data.processorUserId,
    data.processor,
    data.assignee,
    data.approver,
    data.approvalUser,
  );
  if (value) return handlerDisplayName(value) || '系统';
  if (fallbackUserId) return handlerDisplayName(fallbackUserId) || '系统';
  return fallbackLabel || '系统';
}

function reviewNodeLabel(data: JsonRecord, fallback?: string) {
  const taskDefinitionKey = firstText(data.taskDefinitionKey, data.activityId);
  const name = firstText(data.taskName, data.activityName, data.name);
  if (taskDefinitionKey)
    return taskDefinitionLabel(taskDefinitionKey, { name });
  return name || fallback || '任务节点';
}

function reviewDecisionText(data: JsonRecord) {
  const decisionText = firstText(data.decisionText);
  if (decisionText) return decisionText;

  const decision = firstText(data.decision)?.toUpperCase();
  if (decision === 'APPROVED' || decision === 'APPROVE') return '同意';
  if (decision === 'REJECTED' || decision === 'REJECT') return '不同意';
  if (decision === 'RETURNED' || decision === 'RETURN') return '退回补充';

  if (data.approved === true || data.accepted === true) return '同意';
  if (data.approved === false || data.accepted === false) return '不同意';
  return undefined;
}

function reviewStatus(resultLabel: string) {
  if (['同意', '已提交', '完成审批'].includes(resultLabel)) return 'success';
  if (['不同意', '已拒绝'].includes(resultLabel)) return 'error';
  if (resultLabel.includes('退回')) return 'warning';
  if (resultLabel.includes('转交') || resultLabel.includes('委托'))
    return 'processing';
  return 'default';
}

function mergeById<T extends { id: string }>(
  primary: T[] = [],
  fallback: T[] = [],
) {
  const seen = new Set<string>();
  const merged: T[] = [];
  [...primary, ...fallback].forEach((item) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    merged.push(item);
  });
  return merged;
}

export function mergeInstanceFormSnapshots(
  primary: FormSnapshotItem[] = [],
  fallback: FormSnapshotItem[] = [],
) {
  return mergeById(primary, fallback);
}

export function mergeInstanceAuditLogs(
  primary: AuditLogItem[] = [],
  fallback: AuditLogItem[] = [],
) {
  return mergeById(primary, fallback);
}

export function isTaskDetailForInstance(
  instanceId: string,
  detail?: TaskDetail,
) {
  return Boolean(
    instanceId &&
      detail?.task.processInstanceId &&
      detail.task.processInstanceId === instanceId,
  );
}

function auditTaskId(log: AuditLogItem, detail: JsonRecord) {
  return firstText(detail.taskId, detail.resourceId, log.resourceId);
}

function auditReviewItem(log: AuditLogItem): InstanceReviewItem | undefined {
  if (!String(log.action || '').startsWith('TASK_')) return undefined;
  const detail = parseJsonSafe<JsonRecord>(log.detailJson, {}) as JsonRecord;
  const opinion = reviewOpinion(detail);
  if (!opinion && log.action !== 'TASK_COMPLETE') return undefined;

  const resultLabel =
    reviewDecisionText(detail) || auditActionLabel(log.action) || '已处理';
  const taskId = auditTaskId(log, detail);
  return {
    id: `audit-${log.id}`,
    taskId,
    nodeLabel: reviewNodeLabel(detail),
    handlerLabel: reviewHandler(detail, log.userId),
    resultLabel,
    resultStatus: reviewStatus(resultLabel),
    opinion,
    time: log.createdAt,
    source: 'audit',
  };
}

function snapshotReviewItem(
  snapshot: FormSnapshotItem,
  auditByTaskId: Map<string, InstanceReviewItem>,
): InstanceReviewItem | undefined {
  const data = formSnapshotData(snapshot);
  const opinion = reviewOpinion(data);
  const resultLabel =
    reviewDecisionText(data) || (snapshot.taskId ? '已提交' : undefined);
  if (!snapshot.taskId && !resultLabel && !opinion) return undefined;

  const auditItem = snapshot.taskId
    ? auditByTaskId.get(snapshot.taskId)
    : undefined;
  const nodeLabel = reviewNodeLabel(
    data,
    auditItem?.nodeLabel || (snapshot.taskId ? '任务表单' : '发起表单'),
  );

  return {
    id: `snapshot-${snapshot.id}`,
    taskId: snapshot.taskId,
    nodeLabel,
    handlerLabel: reviewHandler(data, undefined, auditItem?.handlerLabel),
    resultLabel: resultLabel || auditItem?.resultLabel || '已提交',
    resultStatus: reviewStatus(
      resultLabel || auditItem?.resultLabel || '已提交',
    ),
    opinion: opinion || auditItem?.opinion,
    time: snapshot.createdAt || auditItem?.time,
    source: 'snapshot',
  };
}

function commentReviewItem(
  comment: TaskCommentItem,
  taskId: string | undefined,
  nodeLabel?: string,
): InstanceReviewItem | undefined {
  const opinion = firstText(comment.message);
  if (!opinion) return undefined;

  return {
    id: `comment-${comment.id}`,
    taskId,
    nodeLabel: nodeLabel || '任务意见',
    handlerLabel: comment.userId
      ? organizationMemberName(comment.userId)
      : '系统',
    resultLabel: '处理意见',
    resultStatus: 'default',
    opinion,
    time: comment.time,
    source: 'comment',
  };
}

function reviewOpinionKey(item: InstanceReviewItem) {
  const opinion = item.opinion?.trim();
  if (!opinion) return undefined;
  return `${item.taskId || ''}::${opinion}`;
}

function reviewTime(value?: string) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

export function buildInstanceReviewItems(
  snapshots: FormSnapshotItem[] = [],
  auditLogs: AuditLogItem[] = [],
  comments: TaskCommentItem[] = [],
  commentTaskId?: string,
) {
  const auditItems = auditLogs.flatMap((log) => {
    const item = auditReviewItem(log);
    return item ? [item] : [];
  });
  const auditByTaskId = new Map(
    auditItems.flatMap((item) => (item.taskId ? [[item.taskId, item]] : [])),
  );
  const snapshotItems = snapshots.flatMap((snapshot) => {
    const item = snapshotReviewItem(snapshot, auditByTaskId);
    return item ? [item] : [];
  });
  const snapshotTaskIds = new Set(
    snapshotItems.map((item) => item.taskId).filter(Boolean),
  );
  const extraAuditItems = auditItems.filter(
    (item) => !item.taskId || !snapshotTaskIds.has(item.taskId),
  );
  const reviewItems = [...snapshotItems, ...extraAuditItems];
  const reviewOpinionKeys = new Set(
    reviewItems.flatMap((item) => {
      const key = reviewOpinionKey(item);
      return key ? [key] : [];
    }),
  );
  const nodeLabelByTaskId = new Map(
    reviewItems.flatMap((item) =>
      item.taskId ? [[item.taskId, item.nodeLabel]] : [],
    ),
  );
  const commentItems = comments.flatMap((comment) => {
    const item = commentReviewItem(
      comment,
      commentTaskId,
      commentTaskId ? nodeLabelByTaskId.get(commentTaskId) : undefined,
    );
    if (!item) return [];
    const key = reviewOpinionKey(item);
    if (key && reviewOpinionKeys.has(key)) return [];
    if (key) reviewOpinionKeys.add(key);
    return [item];
  });

  return [...reviewItems, ...commentItems].sort(
    (left, right) => reviewTime(left.time) - reviewTime(right.time),
  );
}

export function reviewSourceLabel(source: InstanceReviewItem['source']) {
  if (source === 'snapshot') return '表单快照';
  if (source === 'comment') return '任务意见';
  return businessFieldLabel('auditLog');
}
