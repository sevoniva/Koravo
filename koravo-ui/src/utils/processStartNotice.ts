import type { TaskItem } from '@/services/koravo/api';
import { organizationMemberName } from '@/services/koravo/organization';
import { taskDefinitionLabel } from './display';

function uniqueText(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function pendingTaskGroupCount(tasks: TaskItem[]) {
  return new Set(
    tasks.map((task) => task.taskDefinitionKey || task.taskId).filter(Boolean),
  ).size;
}

export function processInstanceDetailPath(
  instanceId: string,
  options?: { started?: boolean; taskId?: string },
) {
  const path = `/process-instances/${encodeURIComponent(instanceId)}`;
  const search = new URLSearchParams();
  if (options?.started) search.set('started', '1');
  if (options?.taskId) search.set('taskId', options.taskId);
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function isStartSuccessRedirect(search?: string) {
  return new URLSearchParams(search || '').get('started') === '1';
}

export function startSuccessDescription(tasks?: TaskItem[]) {
  const pendingTasks = (tasks || []).filter(
    (task) => String(task.status || '').toUpperCase() !== 'COMPLETED',
  );
  if (!pendingTasks.length) return '流程已进入追踪。';

  const nodeText = uniqueText(
    pendingTasks.map((task) => taskDefinitionLabel(task.taskDefinitionKey)),
  ).join('、');
  const handlerText = uniqueText(
    pendingTasks.map((task) =>
      task.assignee ? organizationMemberName(task.assignee) : '待认领',
    ),
  ).join('、');

  if (pendingTasks.length > 1) {
    const taskType =
      pendingTaskGroupCount(pendingTasks) <= 1 ? '会签待办' : '并行待办';
    return `${nodeText}已生成 ${pendingTasks.length} 个${taskType}：${handlerText}`;
  }
  return `${nodeText}待${handlerText}处理`;
}
