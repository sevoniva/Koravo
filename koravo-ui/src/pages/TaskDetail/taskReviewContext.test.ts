import { describe, expect, it } from 'vitest';
import type {
  FormSnapshotItem,
  TaskCommentItem,
  TaskItem,
} from '@/services/koravo/api';
import {
  reviewSnapshotValues,
  shouldShowTaskComments,
  shouldShowTaskSnapshots,
  taskCompleted,
  taskSnapshotForReview,
} from './taskReviewContext';

function task(partial: Partial<TaskItem>): TaskItem {
  return {
    taskId: partial.taskId || 'task-1',
    name: partial.name || '多人会签',
    processInstanceId: partial.processInstanceId || 'instance-1',
    processDefinitionId: partial.processDefinitionId || 'definition-1',
    businessKey: partial.businessKey || 'REQ-1',
    createTime: partial.createTime || '2026-06-15T10:00:00Z',
    assignee: partial.assignee || 'manager',
    taskDefinitionKey: partial.taskDefinitionKey || 'jointApprovalTask',
    status: partial.status || 'RUNNING',
  };
}

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

describe('taskReviewContext', () => {
  it('detects completed tasks case-insensitively', () => {
    expect(taskCompleted(task({ status: 'completed' }))).toBe(true);
    expect(taskCompleted(task({ status: 'RUNNING' }))).toBe(false);
  });

  it('uses the snapshot captured for the current completed task first', () => {
    const current = task({ taskId: 'task-current', status: 'COMPLETED' });
    const startSnapshot = snapshot({
      id: 'start',
      dataJson: JSON.stringify({ subject: '发起数据' }),
      createdAt: '2026-06-15T09:00:00Z',
    });
    const reviewSnapshot = snapshot({
      id: 'review',
      taskId: 'task-current',
      dataJson: JSON.stringify({ subject: '审批数据' }),
      createdAt: '2026-06-15T10:00:00Z',
    });

    expect(
      taskSnapshotForReview(current, [startSnapshot, reviewSnapshot])?.id,
    ).toBe('review');
  });

  it('falls back to the latest task snapshot when there is no exact task match', () => {
    const current = task({ taskId: 'task-current', status: 'COMPLETED' });
    const first = snapshot({
      id: 'first',
      taskId: 'other-1',
      createdAt: '2026-06-15T09:00:00Z',
    });
    const latest = snapshot({
      id: 'latest',
      taskId: 'other-2',
      createdAt: '2026-06-15T11:00:00Z',
    });

    expect(taskSnapshotForReview(current, [first, latest])?.id).toBe('latest');
  });

  it('shows snapshots and comment section for completed task review', () => {
    const doneTask = task({ status: 'COMPLETED' });
    const runningTask = task({ status: 'RUNNING' });
    const snapshots = [snapshot({ id: 'review' })];
    const noComments: TaskCommentItem[] = [];

    expect(shouldShowTaskSnapshots(doneTask, snapshots, false)).toBe(true);
    expect(shouldShowTaskSnapshots(runningTask, snapshots, false)).toBe(false);
    expect(shouldShowTaskComments(doneTask, noComments, false)).toBe(true);
    expect(shouldShowTaskComments(runningTask, noComments, false)).toBe(false);
    expect(shouldShowTaskSnapshots(runningTask, [], true)).toBe(true);
  });

  it('parses and masks snapshot values before rendering business data', () => {
    const values = reviewSnapshotValues(
      snapshot({
        dataJson: JSON.stringify({
          subject: '生产发布',
          accessToken: 'secret-token',
        }),
      }),
    );

    expect(values).toEqual({
      subject: '生产发布',
      accessToken: '******',
    });
  });
});
