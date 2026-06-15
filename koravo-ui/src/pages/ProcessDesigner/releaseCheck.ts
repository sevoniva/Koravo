import type {
  BpmnTaskDefinition,
  BpmnValidationIssue,
  BpmnValidationResult,
  FormBindingItem,
  FormSchemaItem,
  ProcessModelItem,
} from '@/services/koravo/api';
import {
  bpmnValidationIssueText,
  businessFieldLabel,
  taskDefinitionLabel,
} from '@/utils/display';

export const START_FORM_TASK_KEY = '__START__';

export type ReleaseCheckStatus = 'success' | 'warning' | 'error';
export type ReleaseCheckAction = 'bind' | 'inspect';

export interface ReleaseCheckItem {
  key: string;
  status: ReleaseCheckStatus;
  title: string;
  description: string;
  action?: ReleaseCheckAction;
  actionPath?: string;
  elementId?: string;
}

export interface ReleaseCheckState {
  status: ReleaseCheckStatus;
  title: string;
  summary: string;
  deployable: boolean;
  errorCount: number;
  warningCount: number;
  items: ReleaseCheckItem[];
}

interface ReleaseCheckInput {
  activeModel?: ProcessModelItem;
  validation: BpmnValidationResult;
  bindings?: FormBindingItem[];
  schemas?: FormSchemaItem[];
  tasks?: BpmnTaskDefinition[];
  bpmnXml?: string;
}

export function modelBindings(
  model: ProcessModelItem,
  bindings: FormBindingItem[],
) {
  return bindings.filter(
    (binding) =>
      binding.processModelId === model.id ||
      Boolean(
        model.flowableDefinitionId &&
          binding.processDefinitionId === model.flowableDefinitionId,
      ),
  );
}

export function extractUserTasksFromBpmnXml(
  bpmnXml?: string,
): BpmnTaskDefinition[] {
  if (!bpmnXml || typeof DOMParser === 'undefined') return [];

  try {
    const document = new DOMParser().parseFromString(
      bpmnXml,
      'application/xml',
    );
    if (document.querySelector('parsererror')) return [];

    return Array.from(document.getElementsByTagName('*'))
      .filter((element) => element.localName === 'userTask')
      .map((element) => {
        const assignee =
          element.getAttribute('flowable:assignee') ||
          element.getAttribute('assignee') ||
          undefined;
        return {
          taskDefinitionKey: element.getAttribute('id') || '',
          name: element.getAttribute('name') || undefined,
          type: 'userTask',
          assignee,
        };
      })
      .filter((task) => Boolean(task.taskDefinitionKey));
  } catch {
    return [];
  }
}

function extractVariableExpressions(bpmnXml?: string) {
  const matches = bpmnXml?.matchAll(/\$\{([^}]+)\}/g) || [];
  return Array.from(new Set(Array.from(matches, (match) => match[1].trim())))
    .filter(Boolean)
    .slice(0, 8);
}

function issueDescription(issue: BpmnValidationIssue) {
  const location = issue.elementId
    ? taskDefinitionLabel(issue.elementId)
    : '流程文件';
  return `位置：${location}`;
}

function validationIssueItem(
  issue: BpmnValidationIssue,
  status: ReleaseCheckStatus,
  index: number,
): ReleaseCheckItem {
  return {
    key: `${status}-validation-${issue.code}-${issue.elementId || index}`,
    status,
    title: bpmnValidationIssueText(issue),
    description: issueDescription(issue),
    action: issue.elementId ? 'inspect' : undefined,
    elementId: issue.elementId,
  };
}

function parseSchemaFields(schemaJson?: string) {
  if (!schemaJson?.trim()) return new Set<string>();
  try {
    const parsed = JSON.parse(schemaJson) as { properties?: unknown };
    const properties =
      parsed.properties && typeof parsed.properties === 'object'
        ? (parsed.properties as Record<string, unknown>)
        : {};
    return new Set(Object.keys(properties));
  } catch {
    return new Set<string>();
  }
}

const RUNTIME_VARIABLES = new Set([
  'approvalUser',
  'approvalUserId',
  'approvalUserName',
  'assignee',
  'businessKey',
  'requestId',
  'startUserId',
  'tenantId',
]);

function startFormFields(
  bindings: FormBindingItem[],
  schemaMap: Map<string, FormSchemaItem>,
) {
  return bindings.reduce<Set<string>>((fields, binding) => {
    if (binding.taskDefinitionKey !== START_FORM_TASK_KEY) return fields;
    parseSchemaFields(schemaMap.get(binding.formSchemaId)?.schemaJson).forEach(
      (field) => {
        fields.add(field);
      },
    );
    return fields;
  }, new Set<string>());
}

function missingBusinessVariables(
  expressions: string[],
  providedFields: Set<string>,
) {
  return expressions
    .filter((expression) => !RUNTIME_VARIABLES.has(expression))
    .filter((expression) => !providedFields.has(expression));
}

function businessVariableLabels(expressions: string[]) {
  return expressions.map((expression) => businessFieldLabel(expression));
}

export function buildReleaseCheckState({
  activeModel,
  validation,
  bindings = [],
  schemas = [],
  tasks = [],
  bpmnXml,
}: ReleaseCheckInput): ReleaseCheckState {
  const modelScopedBindings = activeModel
    ? modelBindings(activeModel, bindings)
    : [];
  const schemaMap = new Map(schemas.map((schema) => [schema.id, schema]));
  const taskKeys = new Set(tasks.map((task) => task.taskDefinitionKey));
  const relevantBindings = modelScopedBindings.filter(
    (binding) =>
      binding.taskDefinitionKey === START_FORM_TASK_KEY ||
      taskKeys.has(binding.taskDefinitionKey),
  );
  const bindingPath = activeModel
    ? `/form-bindings?processModelId=${activeModel.id}`
    : undefined;
  const hasActiveSchema = (binding: FormBindingItem) =>
    schemaMap.get(binding.formSchemaId)?.status === 'ACTIVE';
  const hasStartBinding = relevantBindings.some(
    (binding) =>
      binding.taskDefinitionKey === START_FORM_TASK_KEY &&
      hasActiveSchema(binding),
  );
  const activeTaskBindings = relevantBindings.filter(
    (binding) =>
      binding.taskDefinitionKey !== START_FORM_TASK_KEY &&
      hasActiveSchema(binding),
  );
  const missingTasks = tasks.filter(
    (task) =>
      !activeTaskBindings.some(
        (binding) => binding.taskDefinitionKey === task.taskDefinitionKey,
      ),
  );
  const invalidBindingCount = relevantBindings.filter(
    (binding) => !hasActiveSchema(binding),
  ).length;
  const outdatedBindingCount = relevantBindings.filter((binding) => {
    const schema = schemaMap.get(binding.formSchemaId);
    return (
      schema?.status === 'ACTIVE' &&
      binding.formSchemaVersion !== schema.version
    );
  }).length;
  const variableExpressions = extractVariableExpressions(bpmnXml);
  const missingVariables = missingBusinessVariables(
    variableExpressions,
    startFormFields(relevantBindings, schemaMap),
  );

  const items: ReleaseCheckItem[] = [];

  if (!activeModel) {
    items.push({
      key: 'model-unsaved',
      status: 'error',
      title: '模型未保存',
      description: '先保存模型，再绑定表单和发布。',
    });
  }

  if (!validation.valid) {
    items.push(
      ...validation.errors.map((issue, index) =>
        validationIssueItem(issue, 'error', index),
      ),
    );
  }

  items.push(
    ...validation.warnings.map((issue, index) =>
      validationIssueItem(issue, 'warning', index),
    ),
  );

  items.push({
    key: 'start-form',
    status: hasStartBinding ? 'success' : 'warning',
    title: '发起表单',
    description: hasStartBinding
      ? '已绑定可用表单。'
      : '发起前需要绑定表单。',
    action: hasStartBinding ? undefined : 'bind',
    actionPath: bindingPath,
  });

  items.push({
    key: 'task-forms',
    status: missingTasks.length === 0 ? 'success' : 'warning',
    title: '任务表单',
    description: tasks.length
      ? missingTasks.length
        ? `未绑定节点：${missingTasks
            .map((task) =>
              taskDefinitionLabel(task.taskDefinitionKey, task),
            )
            .join('、')}`
        : `已绑定 ${tasks.length} 个任务节点。`
      : '当前流程没有人工节点。',
    action: missingTasks.length ? 'bind' : undefined,
    actionPath: bindingPath,
  });

  if (invalidBindingCount > 0) {
    items.push({
      key: 'invalid-bindings',
      status: 'warning',
      title: '表单状态',
      description: `有 ${invalidBindingCount} 个绑定表单不可用。`,
      action: 'bind',
      actionPath: bindingPath,
    });
  }

  if (outdatedBindingCount > 0) {
    items.push({
      key: 'outdated-bindings',
      status: 'warning',
      title: '表单版本',
      description: `有 ${outdatedBindingCount} 个绑定版本待同步。`,
      action: 'bind',
      actionPath: bindingPath,
    });
  }

  if (missingVariables.length > 0) {
    items.push({
      key: 'handler-inputs',
      status: 'error',
      title: '办理人配置',
      description: `缺少办理人来源：${businessVariableLabels(
        missingVariables,
      ).join('、')}`,
      action: 'bind',
      actionPath: bindingPath,
    });
  }

  const errorCount = items.filter((item) => item.status === 'error').length;
  const warningCount = items.filter((item) => item.status === 'warning').length;
  const deployable = errorCount === 0;
  const status: ReleaseCheckStatus = errorCount
    ? 'error'
    : warningCount
      ? 'warning'
      : 'success';

  return {
    status,
    title: deployable
      ? warningCount
        ? '可发布，有提示'
        : '发布检查通过'
      : '发布检查未通过',
    summary: deployable
      ? warningCount
        ? `可发布，仍有 ${warningCount} 条提示。`
        : '流程、办理人和表单绑定已就绪。'
      : `还需处理 ${errorCount} 项。`,
    deployable,
    errorCount,
    warningCount,
    items,
  };
}
