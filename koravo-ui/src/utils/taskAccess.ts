import type { TaskItem } from '@/services/koravo/api';
import { organizationMemberName } from '@/services/koravo/organization';

interface TaskActionAccessParams {
  task?: Pick<TaskItem, 'status' | 'assignee'>;
  currentUserId?: string;
  hasForm?: boolean;
  canClaimTask?: boolean;
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
  if (!task) return '加载中';
  if (String(task.status || '').toUpperCase() === 'COMPLETED') return '已完成';
  const assignee = String(task.assignee || '').trim();
  if (!assignee) return '待认领';
  if (!currentUserId || assignee !== currentUserId) {
    return `待${organizationMemberName(assignee)}处理`;
  }
  return hasForm ? '填写意见并提交' : '未绑定表单';
}
