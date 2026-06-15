import type {
  FormSnapshotItem,
  JsonRecord,
  TaskCommentItem,
  TaskItem,
} from '@/services/koravo/api';
import { maskSecret, parseJsonSafe } from '@/utils/format';

type ReviewTask = Pick<TaskItem, 'status' | 'taskId'> | undefined;

export function taskCompleted(task?: Pick<TaskItem, 'status'>) {
  return String(task?.status || '').toUpperCase() === 'COMPLETED';
}

function snapshotTime(snapshot: FormSnapshotItem) {
  const value = snapshot.createdAt ? Date.parse(snapshot.createdAt) : 0;
  return Number.isNaN(value) ? 0 : value;
}

function latestSnapshot(snapshots: FormSnapshotItem[]) {
  return snapshots.reduce<FormSnapshotItem | undefined>((latest, snapshot) => {
    if (!latest) return snapshot;
    return snapshotTime(snapshot) >= snapshotTime(latest) ? snapshot : latest;
  }, undefined);
}

export function taskSnapshotForReview(
  task: ReviewTask,
  snapshots: FormSnapshotItem[] = [],
) {
  if (!snapshots.length) return undefined;

  const matchedTaskSnapshot = snapshots.find(
    (snapshot) => task?.taskId && snapshot.taskId === task.taskId,
  );
  if (matchedTaskSnapshot) return matchedTaskSnapshot;

  return (
    latestSnapshot(snapshots.filter((snapshot) => snapshot.taskId)) ||
    latestSnapshot(snapshots)
  );
}

export function shouldShowTaskSnapshots(
  task: ReviewTask,
  snapshots: FormSnapshotItem[] = [],
  canViewOperationalContext = false,
) {
  if (canViewOperationalContext) return true;
  return taskCompleted(task) && snapshots.length > 0;
}

export function shouldShowTaskComments(
  task: ReviewTask,
  comments: TaskCommentItem[] = [],
  canViewOperationalContext = false,
) {
  return (
    canViewOperationalContext || taskCompleted(task) || comments.length > 0
  );
}

export function reviewSnapshotValues(snapshot?: FormSnapshotItem) {
  if (!snapshot) return undefined;
  return maskSecret(
    parseJsonSafe<JsonRecord>(snapshot.dataJson, {}) as JsonRecord,
  ) as JsonRecord;
}
