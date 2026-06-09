import type { BpmnTaskDefinition, ProcessModelItem } from '../types/koravo';

const AUDIT_ACTION_LABELS: Record<string, string> = {
  DEMO_INIT: '流程资产检查',
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
  TASK_TRANSFER: '转交任务',
  TASK_DELEGATE: '委托任务',
  TASK_CLAIM: '认领任务',
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
  DATASOURCE_TEST_LOG: '数据源测试',
  FAILED_JOB: '失败任务',
  DEAD_LETTER_JOB: '死信任务',
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

const BUSINESS_FIELD_LABELS: Record<string, string> = {
  applicant: '发起人',
  requester: '发起人',
  department: '所属部门',
  itemName: '事项名称',
  subject: '事项名称',
  amount: '金额',
  reason: '事项说明',
  acceptanceScope: '验收事项',
  expectedResult: '验收标准',
  description: '事项说明',
  remark: '备注',
  managerApprover: '业务处理人',
  financeApprover: '财务复核人',
  accepted: '验收通过',
  reviewComment: '验收意见',
  approver: '处理人',
  handler: '处理人',
  role: '角色',
  approved: '处理结论',
  decision: '处理结论',
  decisionText: '处理结论',
  opinion: '处理意见',
  businessKey: '业务编号',
  id: '编号',
  code: '结果编码',
  data: '业务数据',
  message: '结果说明',
  requestId: '追踪号',
  tenantId: '租户',
  userId: '用户',
  createdAt: '创建时间',
  updatedAt: '更新时间',
  time: '时间',
  modelKey: '流程编码',
  modelName: '流程名称',
  processDefinitionKey: '流程定义编码',
  processDefinitionId: '流程定义编号',
  processInstanceId: '流程实例编号',
  taskId: '任务编号',
  taskDefinitionKey: '任务节点',
  taskName: '任务名称',
  formSchemaId: '表单编号',
  formKey: '表单编码',
  formName: '表单名称',
  version: '版本',
  status: '状态',
  statusText: '状态说明',
  name: '名称',
  type: '类型',
  success: '是否成功',
  connected: '连接结果',
  elapsedMillis: '耗时',
  retries: '重试次数',
  errorMessage: '错误信息',
  reasonMessage: '原因',
  url: '请求地址',
  method: '请求方式',
  statusCode: '状态码',
  headers: '请求头',
  body: '请求体',
  'X-Tenant-Id': '租户',
  'X-User-Id': '用户',
  request: '请求',
  response: '响应',
};

function readableIdentifier(value?: string | null) {
  if (!value) return '-';
  const text = value.trim();
  if (!text) return '-';
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function processDisplayName(modelKey?: string, fallback?: string) {
  const mapping: Record<string, string> = {
    designerDeployCheck: '流程发布检查',
    httpConnectorDemo: 'HTTP 健康检查',
    httpHealthCheck: 'HTTP 健康检查',
    purchaseApproval: '多人验收流程',
    multiAcceptance: '多人验收流程',
  };
  return mapping[modelKey || ''] || fallback || readableIdentifier(modelKey);
}

export function processModelKeyLabel(modelKey?: string | null) {
  const mapping: Record<string, string> = {
    httpConnectorDemo: 'httpHealthCheck',
    purchaseApproval: 'multiAcceptance',
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
  return productCopy(description);
}

export function productCopy(value?: string | null) {
  if (!value) return '';
  return value
    .replaceAll('演示数据', '流程配置')
    .replaceAll('演示流程', '内置流程')
    .replaceAll('演示接口', '配置接口')
    .replaceAll('内置演示', '内置')
    .replaceAll('演示', '')
    .replaceAll('采购申请提交后，部门审批和财务审批并行处理。', '验收申请提交后，业务验收和财务验收并行处理。')
    .replaceAll('采购申请单', '验收申请表')
    .replaceAll('采购申请', '验收申请')
    .replaceAll('采购内容', '验收事项')
    .replaceAll('采购原因', '事项说明')
    .replaceAll('部门验收', '业务验收')
    .replace(/\s+/g, ' ')
    .trim();
}

export function processKindLabel(modelKey?: string) {
  const mapping: Record<string, string> = {
    httpConnectorDemo: 'HTTP 连接器调用流程',
    httpHealthCheck: 'HTTP 连接器调用流程',
    purchaseApproval: '多人验收流程',
    multiAcceptance: '多人验收流程',
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
    managerApprovalTask: '业务验收',
    financeApprovalTask: '财务验收',
    businessAcceptanceTask: '业务验收',
    financeAcceptanceTask: '财务验收',
    reviewTask: '业务审批',
    Task_1: '提交申请',
    approveTask: '处理任务',
  };
  return task?.name || mapping[key] || readableIdentifier(key);
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

export function businessFieldLabel(value?: string | null) {
  if (!value) return '-';
  return BUSINESS_FIELD_LABELS[value] || readableIdentifier(value);
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
