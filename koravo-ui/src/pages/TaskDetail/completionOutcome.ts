import type { TaskItem } from '@/services/koravo/api';
import { organizationMemberName } from '@/services/koravo/organization';
import { taskDefinitionLabel } from '@/utils/display';

export interface RemainingTaskSummary {
  taskId: string;
  nodeLabel: string;
  handlerLabel: string;
  currentUserTask: boolean;
}

export interface TaskCompletionOutcome {
  nextTask?: TaskItem;
  remainingTasks: TaskItem[];
  title: string;
  summary: string;
  nextStep: string;
  remainingTaskSummaries: RemainingTaskSummary[];
}

function taskOpen(task: TaskItem) {
  return String(task.status || '').toUpperCase() !== 'COMPLETED';
}

function sameNode(task: TaskItem, target: TaskItem) {
  return (task.taskDefinitionKey || task.taskId) ===
    (target.taskDefinitionKey || target.taskId);
}

function remainingPendingTasks(currentTask: TaskItem, tasks: TaskItem[]) {
  return tasks.filter(
    (task) => task.taskId !== currentTask.taskId && taskOpen(task),
  );
}

function nextPendingTask(currentTask: TaskItem, tasks: TaskItem[]) {
  return remainingPendingTasks(currentTask, tasks).find(
    (task) => task.assignee && task.assignee === currentTask.assignee,
  );
}

function taskNodeLabel(task: TaskItem) {
  return taskDefinitionLabel(task.taskDefinitionKey, { name: task.name });
}

function taskHandlerLabel(task: TaskItem) {
  return task.assignee ? organizationMemberName(task.assignee) : '未分配';
}

export function buildTaskCompletionOutcome(
  currentTask: TaskItem,
  currentTasks: TaskItem[] = [],
): TaskCompletionOutcome {
  const remainingTasks = remainingPendingTasks(currentTask, currentTasks);
  const nextTask = nextPendingTask(currentTask, currentTasks);
  const remainingTaskSummaries = remainingTasks.map((task) => ({
    taskId: task.taskId,
    nodeLabel: taskNodeLabel(task),
    handlerLabel: taskHandlerLabel(task),
    currentUserTask: Boolean(
      task.assignee &&
        currentTask.assignee &&
        task.assignee === currentTask.assignee,
    ),
  }));

  if (nextTask) {
    const nextNode = taskNodeLabel(nextTask);
    return {
      nextTask,
      remainingTasks,
      remainingTaskSummaries,
      title: '可继续处理',
      summary: `下一节点：${nextNode}`,
      nextStep: `你还有待办，继续处理「${nextNode}」。`,
    };
  }

  if (!remainingTasks.length) {
    return {
      remainingTasks,
      remainingTaskSummaries,
      title: '流程已无当前待办',
      summary: '流程已无当前待办。',
      nextStep: '查看实例进度和审批记录。',
    };
  }

  const allSameNode = remainingTasks.every((task) => sameNode(task, currentTask));
  const handlers = remainingTaskSummaries
    .map((task) => task.handlerLabel)
    .join('、');
  const title = allSameNode ? '会签处理中' : '并行审批中';
  const summary = allSameNode
    ? `仍有 ${remainingTasks.length} 个会签任务待处理。`
    : `仍有 ${remainingTasks.length} 个并行任务待处理。`;

  return {
    remainingTasks,
    remainingTaskSummaries,
    title,
    summary,
    nextStep: handlers ? `等待${handlers}提交。` : '等待剩余任务完成。',
  };
}
