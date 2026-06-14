import type { TaskItem } from '@/services/koravo/api';
import { organizationMemberName } from '@/services/koravo/organization';
import { taskDefinitionLabel } from './display';

function uniqueText(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function processInstanceDetailPath(
  instanceId: string,
  options?: { started?: boolean },
) {
  const path = `/process-instances/${encodeURIComponent(instanceId)}`;
  return options?.started ? `${path}?started=1` : path;
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
    return `${nodeText}已生成 ${pendingTasks.length} 个并行待办：${handlerText}`;
  }
  return `${nodeText}待${handlerText}处理`;
}
