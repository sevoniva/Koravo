import type { TaskItem } from '@/services/koravo/api';
import { organizationMemberName } from '@/services/koravo/organization';

interface TaskActionAccessParams {
  task?: Pick<TaskItem, 'status' | 'assignee'>;
  currentUserId?: string;
  hasForm?: boolean;
  canClaimTask?: boolean;
}

export type TaskHandlingState =
  | 'loading'
  | 'done'
  | 'ready'
  | 'blocked'
  | 'claimable'
  | 'unassigned'
  | 'waiting';

export interface TaskHandlingSummary {
  state: TaskHandlingState;
  instruction: string;
  assigneeText: string;
  requirement: string;
  nextStep: string;
}

export function taskActionAccess({
  task,
  currentUserId,
  hasForm,
  canClaimTask,
}: TaskActionAccessParams) {
  const isOpenTask =
    Boolean(task) && String(task?.status || '').toUpperCase() !== 'COMPLETED';
  const assignee = String(task?.assignee || '').trim();
  const isCurrentAssignee =
    isOpenTask && Boolean(assignee && currentUserId && assignee === currentUserId);

  return {
    isOpenTask,
    isCurrentAssignee,
    canCompleteTask: isCurrentAssignee && Boolean(hasForm),
    canManageAssignedTask: isCurrentAssignee,
    canClaimDetailTask: isOpenTask && !assignee && Boolean(canClaimTask),
  };
}

export function taskHandlingInstruction({
  task,
  currentUserId,
  hasForm,
}: Pick<TaskActionAccessParams, 'task' | 'currentUserId' | 'hasForm'>) {
  return taskHandlingSummary({ task, currentUserId, hasForm }).instruction;
}

export function taskHandlingSummary({
  task,
  currentUserId,
  hasForm,
  canClaimTask,
}: Pick<
  TaskActionAccessParams,
  'task' | 'currentUserId' | 'hasForm' | 'canClaimTask'
>): TaskHandlingSummary {
  if (!task) {
    return {
      state: 'loading',
      instruction: '加载中',
      assigneeText: '读取中',
      requirement: '读取任务信息',
      nextStep: '读取后显示办理要求',
    };
  }

  if (String(task.status || '').toUpperCase() === 'COMPLETED') {
    return {
      state: 'done',
      instruction: '已完成',
      assigneeText: task.assignee ? organizationMemberName(task.assignee) : '已处理',
      requirement: '无需操作',
      nextStep: '查看实例进度',
    };
  }

  const assignee = String(task.assignee || '').trim();
  if (!assignee) {
    return canClaimTask
      ? {
          state: 'claimable',
          instruction: '可认领',
          assigneeText: '未分配',
          requirement: '先认领任务',
          nextStep: '认领后办理',
        }
      : {
          state: 'unassigned',
          instruction: '待认领',
          assigneeText: '未分配',
          requirement: '等待有权限成员认领',
          nextStep: '认领后办理',
        };
  }

  if (!currentUserId || assignee !== currentUserId) {
    const assigneeName = organizationMemberName(assignee);
    return {
      state: 'waiting',
      instruction: `待${assigneeName}处理`,
      assigneeText: assigneeName,
      requirement: '等待处理人提交',
      nextStep: '提交后进入下一节点',
    };
  }

  if (!hasForm) {
    return {
      state: 'blocked',
      instruction: '表单未配置',
      assigneeText: '你',
      requirement: '联系管理员配置表单',
      nextStep: '配置后办理',
    };
  }

  return {
    state: 'ready',
    instruction: '待你办理',
    assigneeText: '你',
    requirement: '填写表单并提交',
    nextStep: '提交后进入下一节点',
  };
}
