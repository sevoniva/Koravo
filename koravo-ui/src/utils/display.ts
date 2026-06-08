import type { BpmnTaskDefinition, ProcessModelItem } from '../types/koravo';

const AUDIT_ACTION_LABELS: Record<string, string> = {
  DEMO_INIT: '资产检查',
  WORKFLOW_ENABLEMENT_INIT: '补齐流程资产',
  PROCESS_MODEL_CREATE: '创建流程模型',
  PROCESS_MODEL_IMPORT: '导入流程模型',
  PROCESS_MODEL_UPDATE: '更新流程模型',
  PROCESS_MODEL_DEPLOY: '部署流程模型',
  PROCESS_MODEL_DISABLE: '停用流程模型',
  PROCESS_MODEL_ARCHIVE: '归档流程模型',
  PROCESS_INSTANCE_START: '启动流程实例',
  PROCESS_INSTANCE_SUSPEND: '挂起流程实例',
  PROCESS_INSTANCE_ACTIVATE: '激活流程实例',
  PROCESS_INSTANCE_TERMINATE: '终止流程实例',
  TASK_COMPLETE: '完成任务',
  FORM_SCHEMA_CREATE: '创建表单',
  FORM_SCHEMA_UPDATE: '更新表单',
  FORM_BIND: '绑定表单',
  FORM_BIND_UPDATE: '更新表单绑定',
  FORM_BIND_DELETE: '删除表单绑定',
  DATASOURCE_CREATE: '创建数据源',
  DATASOURCE_UPDATE: '更新数据源',
  DATASOURCE_DELETE: '删除数据源',
  DATASOURCE_TEST: '测试数据源',
  CONNECTOR_EXECUTE: '执行连接器',
};

const AUDIT_RESOURCE_LABELS: Record<string, string> = {
  DEMO: '基础配置',
  WORKFLOW_ENABLEMENT: '流程配置',
  PROCESS_MODEL: '流程模型',
  PROCESS_INSTANCE: '流程实例',
  TASK: '任务',
  FORM_SCHEMA: '表单',
  FORM_BINDING: '表单绑定',
  DATASOURCE: '数据源',
  CONNECTOR_EXECUTION: '连接器执行',
};

const PROCESS_STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  DEPLOYED: '已部署',
  DISABLED: '已停用',
  ARCHIVED: '已归档',
};

const DATASOURCE_TYPE_LABELS: Record<string, string> = {
  POSTGRESQL: 'PostgreSQL',
  MYSQL: 'MySQL',
  H2: 'H2',
};

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  ...AUDIT_RESOURCE_LABELS,
  DATASOURCE_TEST_LOG: '数据源测试',
  FAILED_JOB: '失败任务',
  DEAD_LETTER_JOB: '死信任务',
};

const CONNECTOR_TYPE_LABELS: Record<string, string> = {
  http: 'HTTP',
  jdbc: 'JDBC',
  HTTP: 'HTTP',
  JDBC: 'JDBC',
};

export function processDisplayName(modelKey?: string, fallback?: string) {
  const mapping: Record<string, string> = {
    purchaseApproval: '采购申请',
    leaveApproval: '请假审批',
    httpConnectorDemo: 'HTTP 健康检查',
    httpHealthCheck: 'HTTP 健康检查',
  };
  return mapping[modelKey || ''] || fallback || modelKey || '-';
}

export function processModelKeyLabel(modelKey?: string | null) {
  const mapping: Record<string, string> = {
    httpConnectorDemo: 'httpHealthCheck',
  };
  if (!modelKey) return '-';
  return mapping[modelKey] || modelKey;
}

export function processDescriptionLabel(
  model?: Pick<ProcessModelItem, 'modelKey' | 'description'> | null,
) {
  const description = model?.description?.trim();
  if (!description || /演示|示例|demo/i.test(description)) {
    return processKindLabel(model?.modelKey);
  }
  return description;
}

export function productCopy(value?: string | null) {
  if (!value) return '';
  return value
    .replaceAll('演示数据', '流程配置')
    .replaceAll('演示流程', '内置流程')
    .replaceAll('演示接口', '配置接口')
    .replaceAll('内置演示', '内置')
    .replaceAll('演示', '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function processKindLabel(modelKey?: string) {
  const mapping: Record<string, string> = {
    purchaseApproval: '采购申请流程',
    leaveApproval: '人员请假审批流程',
    httpConnectorDemo: 'HTTP 连接器调用流程',
    httpHealthCheck: 'HTTP 连接器调用流程',
  };
  return mapping[modelKey || ''] || '流程模型';
}

export function processDefinitionLabel(value?: string) {
  if (!value) return '';
  const [key, version] = value.split(':');
  const name = processDisplayName(key);
  return version ? `${name} v${version}` : name;
}

export function taskDefinitionLabel(
  key?: string,
  task?: Pick<BpmnTaskDefinition, 'name'>,
) {
  if (!key) return '-';
  const mapping: Record<string, string> = {
    managerApprovalTask: '部门审批',
    financeApprovalTask: '财务审批',
    approveTask: '审批请假',
    reviewTask: '确认调用结果',
  };
  return task?.name || mapping[key] || key;
}

export function auditActionLabel(value?: string | null) {
  return auditCodeLabel(value, AUDIT_ACTION_LABELS);
}

export function auditResourceLabel(value?: string | null) {
  return auditCodeLabel(value, AUDIT_RESOURCE_LABELS);
}

export function processStatusLabel(value?: string | null) {
  return auditCodeLabel(value, PROCESS_STATUS_LABELS);
}

export function dataSourceTypeLabel(value?: string | null) {
  return auditCodeLabel(value, DATASOURCE_TYPE_LABELS);
}

export function resourceTypeLabel(value?: string | null) {
  return auditCodeLabel(value, RESOURCE_TYPE_LABELS);
}

export function connectorTypeLabel(value?: string | null) {
  return auditCodeLabel(value, CONNECTOR_TYPE_LABELS);
}

export function shortTraceLabel(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return '';
  const text = String(value);
  return text.length > 12 ? text.slice(0, 8) : text;
}

function auditCodeLabel(
  value: string | null | undefined,
  mapping: Record<string, string>,
) {
  if (!value) return '-';
  const normalized = value.trim();
  if (!normalized) return '-';
  return mapping[normalized] || mapping[normalized.toUpperCase()] || normalized;
}
