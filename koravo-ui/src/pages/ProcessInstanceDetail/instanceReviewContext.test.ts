import { describe, expect, it } from 'vitest';
import type { AuditLogItem, FormSnapshotItem } from '@/services/koravo/api';
import {
  buildInstanceReviewItems,
  formSnapshotData,
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

  it('parses snapshot data safely', () => {
    expect(
      formSnapshotData(snapshot({ dataJson: '{"subject":"发布"}' })),
    ).toEqual({
      subject: '发布',
    });
    expect(formSnapshotData(snapshot({ dataJson: '{bad json' }))).toEqual({});
  });
});
