export type TaskTabKey = 'todo' | 'candidate' | 'done' | 'started';

export const taskTabRoutes: Record<TaskTabKey, string> = {
  todo: '/tasks',
  candidate: '/task-claims',
  done: '/done-tasks',
  started: '/started-instances',
};

export const taskTabMeta: Record<TaskTabKey, { title: string }> = {
  todo: {
    title: '我的待办',
  },
  candidate: {
    title: '待认领',
  },
  done: {
    title: '已办任务',
  },
  started: {
    title: '我的申请',
  },
};

interface TaskTabAccess {
  canHandleTask?: boolean;
  canClaimTask?: boolean;
  canStartProcess?: boolean;
}

export function tabFromPath(pathname: string): TaskTabKey {
  if (pathname === taskTabRoutes.candidate) return 'candidate';
  if (pathname === taskTabRoutes.done) return 'done';
  if (pathname === taskTabRoutes.started) return 'started';
  return 'todo';
}

export function visibleTaskTabs({
  canHandleTask,
  canClaimTask,
  canStartProcess,
}: TaskTabAccess): TaskTabKey[] {
  const tabs: TaskTabKey[] = [];
  if (canHandleTask) tabs.push('todo');
  if (canClaimTask) tabs.push('candidate');
  if (canHandleTask) tabs.push('done');
  if (canStartProcess) tabs.push('started');
  return tabs;
}

export function resolveTaskTab(
  requested: TaskTabKey,
  visibleTabs: TaskTabKey[],
): TaskTabKey {
  return visibleTabs.includes(requested) ? requested : visibleTabs[0] || requested;
}
