import { describe, expect, it } from 'vitest';
import type {
  AuditLogItem,
  FormSnapshotItem,
  TaskCommentItem,
  TaskDetail,
  TaskItem,
} from '@/services/koravo/api';
import {
  buildInstanceReviewItems,
  formSnapshotData,
  isTaskDetailForInstance,
  mergeInstanceAuditLogs,
  mergeInstanceFormSnapshots,
} from './instanceReviewContext';

function snapshot(partial: Partial<FormSnapshotItem>): FormSnapshotItem {
  return {
    id: partial.id || 'snapshot-1',
    processInstanceId: partial.processInstanceId || 'instance-1',
    taskId: partial.taskId,
    formSchemaId: partial.formSchemaId || 'form-1',
    formKey: partial.formKey || 'generic_request',
    formName: partial.formName || '通用申请',
    formSchemaVersion: partial.formSchemaVersion || 1,
    schemaJson: partial.schemaJson,
    uiSchemaJson: partial.uiSchemaJson,
    dataJson: partial.dataJson || '{}',
    createdAt: partial.createdAt,
  };
}

function audit(partial: Partial<AuditLogItem>): AuditLogItem {
  return {
    id: partial.id || 'audit-1',
    tenantId: partial.tenantId || 'default',
    userId: partial.userId || 'manager',
    action: partial.action || 'TASK_COMPLETE',
    resourceType: partial.resourceType || 'TASK',
    resourceId: partial.resourceId,
    requestId: partial.requestId,
    clientIp: partial.clientIp,
    detailJson: partial.detailJson,
    createdAt: partial.createdAt || '2026-06-15T10:00:00Z',
  };
}

function comment(partial: Partial<TaskCommentItem>): TaskCommentItem {
  return {
    id: partial.id || 'comment-1',
    userId: partial.userId || 'manager',
    message: partial.message || '已核对',
    time: partial.time || '2026-06-15T10:10:00Z',
  };
}

function task(partial: Partial<TaskItem>): TaskItem {
  return {
    taskId: partial.taskId || 'task-1',
    name: partial.name || '审批处理',
    processInstanceId: partial.processInstanceId || 'instance-1',
    processDefinitionId: partial.processDefinitionId || 'definition-1',
    businessKey: partial.businessKey || 'REQ-1',
    createTime: partial.createTime || '2026-06-15T10:00:00Z',
    assignee: partial.assignee || 'manager',
    taskDefinitionKey: partial.taskDefinitionKey || 'approvalTask',
    status: partial.status || 'COMPLETED',
  };
}

function taskDetail(partial: Partial<TaskDetail>): TaskDetail {
  return {
    task: partial.task || task({}),
    formBinding: partial.formBinding,
    formSchema: partial.formSchema,
    processVariables: partial.processVariables || {},
    taskVariables: partial.taskVariables || {},
    comments: partial.comments || [],
    formSnapshots: partial.formSnapshots || [],
    auditLogs: partial.auditLogs || [],
  };
}

describe('instanceReviewContext', () => {
  it('builds review rows from approval snapshots without exposing raw json', () => {
    const rows = buildInstanceReviewItems([
      snapshot({
        id: 'review',
        taskId: 'task-1',
        createdAt: '2026-06-15T10:00:00Z',
        dataJson: JSON.stringify({
          taskDefinitionKey: 'jointApprovalTask',
          assignee: 'manager',
          approved: true,
          opinion: '同意发布',
        }),
      }),
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        taskId: 'task-1',
        nodeLabel: '多人会签',
        handlerLabel: '审批主管',
        resultLabel: '同意',
        opinion: '同意发布',
        source: 'snapshot',
      }),
    ]);
  });

  it('uses audit comments to complete snapshot review rows', () => {
    const rows = buildInstanceReviewItems(
      [
        snapshot({
          id: 'review',
          taskId: 'task-1',
          dataJson: JSON.stringify({
            approved: true,
          }),
        }),
      ],
      [
        audit({
          resourceId: 'task-1',
          detailJson: JSON.stringify({
            taskId: 'task-1',
            taskDefinitionKey: 'jointApprovalTask',
            comment: '已核对材料',
          }),
        }),
      ],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        nodeLabel: '多人会签',
        resultLabel: '同意',
        opinion: '已核对材料',
      }),
    );
  });

  it('uses the audit handler label when snapshot data has no handler field', () => {
    const rows = buildInstanceReviewItems(
      [
        snapshot({
          id: 'review',
          taskId: 'task-1',
          dataJson: JSON.stringify({
            approved: true,
          }),
        }),
      ],
      [
        audit({
          resourceId: 'task-1',
          userId: 'manager',
          detailJson: JSON.stringify({
            taskId: 'task-1',
            taskDefinitionKey: 'jointApprovalTask',
          }),
        }),
      ],
    );

    expect(rows[0]).toEqual(
      expect.objectContaining({
        handlerLabel: '审批主管',
        source: 'snapshot',
      }),
    );
  });

  it('keeps task audit comments when there is no matching snapshot', () => {
    const rows = buildInstanceReviewItems(
      [],
      [
        audit({
          id: 'transfer',
          action: 'TASK_TRANSFER',
          resourceId: 'task-2',
          detailJson: JSON.stringify({
            taskDefinitionKey: 'approvalTask',
            reason: '转给主管处理',
          }),
        }),
      ],
    );

    expect(rows).toEqual([
      expect.objectContaining({
        taskId: 'task-2',
        nodeLabel: '审批处理',
        handlerLabel: '审批主管',
        resultLabel: '转交任务',
        opinion: '转给主管处理',
        source: 'audit',
      }),
    ]);
  });

  it('adds focused task comments as review rows', () => {
    const rows = buildInstanceReviewItems(
      [
        snapshot({
          id: 'review',
          taskId: 'task-1',
          createdAt: '2026-06-15T10:00:00Z',
          dataJson: JSON.stringify({
            taskDefinitionKey: 'approvalTask',
            approved: true,
          }),
        }),
      ],
      [],
      [comment({ id: 'comment-1', message: '材料齐全' })],
      'task-1',
    );

    expect(rows).toEqual([
      expect.objectContaining({
        source: 'snapshot',
        resultLabel: '同意',
      }),
      expect.objectContaining({
        taskId: 'task-1',
        nodeLabel: '审批处理',
        handlerLabel: '审批主管',
        resultLabel: '处理意见',
        opinion: '材料齐全',
        source: 'comment',
      }),
    ]);
  });

  it('does not duplicate comments already present in snapshots', () => {
    const rows = buildInstanceReviewItems(
      [
        snapshot({
          id: 'review',
          taskId: 'task-1',
          dataJson: JSON.stringify({
            approved: true,
            opinion: '材料齐全',
          }),
        }),
      ],
      [],
      [comment({ id: 'comment-1', message: '材料齐全' })],
      'task-1',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        opinion: '材料齐全',
        source: 'snapshot',
      }),
    );
  });

  it('merges task detail fallbacks without replacing instance data', () => {
    const primarySnapshot = snapshot({ id: 'snapshot-1' });
    const fallbackSnapshot = snapshot({ id: 'snapshot-2', taskId: 'task-2' });
    const primaryAudit = audit({ id: 'audit-1' });
    const fallbackAudit = audit({ id: 'audit-2', resourceId: 'task-2' });

    expect(
      mergeInstanceFormSnapshots(
        [primarySnapshot],
        [primarySnapshot, fallbackSnapshot],
      ).map((item) => item.id),
    ).toEqual(['snapshot-1', 'snapshot-2']);
    expect(
      mergeInstanceAuditLogs([primaryAudit], [primaryAudit, fallbackAudit]).map(
        (item) => item.id,
      ),
    ).toEqual(['audit-1', 'audit-2']);
  });

  it('only accepts task detail from the current process instance', () => {
    expect(
      isTaskDetailForInstance(
        'instance-1',
        taskDetail({ task: task({ processInstanceId: 'instance-1' }) }),
      ),
    ).toBe(true);
    expect(
      isTaskDetailForInstance(
        'instance-1',
        taskDetail({ task: task({ processInstanceId: 'instance-2' }) }),
      ),
    ).toBe(false);
  });

  it('parses snapshot data safely', () => {
    expect(
      formSnapshotData(snapshot({ dataJson: '{"subject":"发布"}' })),
    ).toEqual({
      subject: '发布',
    });
    expect(formSnapshotData(snapshot({ dataJson: '{bad json' }))).toEqual({});
  });
});
