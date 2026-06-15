import type { BpmnTaskDefinition, ProcessModelItem } from '../types/koravo';

const AUDIT_ACTION_LABELS: Record<string, string> = {
  AUTH_LOGIN: '登录系统',
  AUTH_LOGOUT: '退出登录',
  ACCESS_DENIED: '拦截接口访问',
  WORKFLOW_ENABLEMENT_INIT: '维护流程配置',
  PROCESS_MODEL_CREATE: '创建流程模型',
  PROCESS_MODEL_IMPORT: '导入流程模型',
  PROCESS_MODEL_UPDATE: '更新流程模型',
  PROCESS_MODEL_DEPLOY: '发布流程模型',
  PROCESS_MODEL_DISABLE: '停用流程模型',
  PROCESS_MODEL_ARCHIVE: '归档流程模型',
  PROCESS_MODEL_RESTORE_DRAFT: '恢复流程草稿',
  PROCESS_MODEL_ASSET_ORIGIN_UPDATE: '调整模型归类',
  PROCESS_INSTANCE_START: '发起流程实例',
  PROCESS_INSTANCE_SUSPEND: '挂起流程实例',
  PROCESS_INSTANCE_ACTIVATE: '激活流程实例',
  PROCESS_INSTANCE_TERMINATE: '终止流程实例',
  TASK_COMPLETE: '完成任务',
  TASK_TRANSFER: '转交任务',
  TASK_DELEGATE: '委托任务',
  TASK_CLAIM: '认领任务',
  FORM_SCHEMA_CREATE: '创建表单',
  FORM_SCHEMA_UPDATE: '更新表单',
  FORM_SCHEMA_RESTORE_VERSION: '恢复表单版本',
  FORM_SCHEMA_ACTIVATE: '启用表单',
  FORM_SCHEMA_DISABLE: '停用表单',
  FORM_BIND: '绑定表单',
  FORM_BIND_UPDATE: '更新表单绑定',
  FORM_BIND_DELETE: '删除表单绑定',
  ORG_MEMBER_CREATE: '创建成员',
  ORG_MEMBER_UPDATE: '更新成员',
  ORG_MEMBER_ENABLE: '启用成员',
  ORG_MEMBER_DISABLE: '停用成员',
  ORG_MEMBER_PASSWORD_RESET: '重置成员密码',
  DATASOURCE_CREATE: '创建数据源',
  DATASOURCE_UPDATE: '更新数据源',
  DATASOURCE_DELETE: '删除数据源',
  DATASOURCE_TEST: '检测数据源连接',
  FAILED_JOB_RETRY: '重试失败任务',
  FAILED_JOB_DELETE: '删除失败任务',
  DEAD_LETTER_JOB_RETRY: '重试死信任务',
  DEAD_LETTER_JOB_DELETE: '删除死信任务',
  CONNECTOR_EXECUTE: '执行连接器',
  CONNECTOR_RETRY: '重试连接器',
};

const AUDIT_RESOURCE_LABELS: Record<string, string> = {
  LOGIN_SESSION: '登录会话',
  API_ENDPOINT: '接口',
  WORKFLOW_ENABLEMENT: '流程配置',
  PROCESS_MODEL: '流程模型',
  PROCESS_INSTANCE: '流程实例',
  TASK: '任务',
  FORM_SCHEMA: '表单',
  FORM_BINDING: '表单绑定',
  ORGANIZATION_MEMBER: '组织成员',
  DATASOURCE: '数据源',
  DATASOURCE_TEST_LOG: '数据源检测记录',
  FAILED_JOB: '失败任务',
  DEAD_LETTER_JOB: '死信任务',
  CONNECTOR_EXECUTION: '连接器执行',
};

const PROCESS_STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  DEPLOYED: '已发布',
  DISABLED: '已停用',
  ARCHIVED: '已归档',
  RUNNING: '运行中',
  ACTIVE: '处理中',
  COMPLETED: '已完成',
  TERMINATED: '已终止',
  SUSPENDED: '已挂起',
  FAILED: '失败',
  READY: '就绪',
  AVAILABLE: '可用',
};

const GENERIC_STATUS_LABELS: Record<string, string> = {
  ...PROCESS_STATUS_LABELS,
  ACTIVE: '启用',
  DISABLED: '已停用',
  ENABLED: '启用',
  INACTIVE: '停用',
};

const DATASOURCE_TYPE_LABELS: Record<string, string> = {
  POSTGRESQL: 'PostgreSQL',
  MYSQL: 'MySQL',
  H2: 'H2',
};

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  ...AUDIT_RESOURCE_LABELS,
  API_ENDPOINT: '接口',
  DATASOURCE_TEST_LOG: '数据源检测记录',
  FAILED_JOB: '失败任务',
  DEAD_LETTER_JOB: '死信任务',
};

const CONNECTOR_TYPE_LABELS: Record<string, string> = {
  http: 'HTTP',
  jdbc: 'JDBC',
  HTTP: 'HTTP',
  JDBC: 'JDBC',
};

const GENERATED_DEPARTMENT_NAMES = [
  '一',
  '二',
  '三',
  '四',
  '五',
  '六',
  '七',
  '八',
  '九',
  '十',
];

const APPROVAL_STAGE_NAMES = [
  '一审',
  '二审',
  '三审',
  '四审',
  '五审',
  '六审',
  '七审',
  '八审',
  '九审',
  '十审',
];

const LEGACY_PROCESS_KEYS = new Set([
  'multiAcceptance',
  'purchaseApproval',
  'leaveApproval',
  'httpConnectorDemo',
  'designerDeployCheck',
]);

const LEGACY_FORM_KEYS = new Set([
  'acceptance-request-form',
  'purchase-request-form',
  'leave-form',
]);

export const ASSET_ORIGIN_LABELS: Record<string, string> = {
  SYSTEM_TEMPLATE: '系统模板',
  USER_FLOW: '用户流程',
  LEGACY_DEMO: '历史资产',
  TEST_FIXTURE: '验证数据',
  SAMPLE: '模板资产',
};

export const ASSET_ORIGIN_COLORS: Record<string, string> = {
  SYSTEM_TEMPLATE: 'processing',
  USER_FLOW: 'success',
  LEGACY_DEMO: 'warning',
  TEST_FIXTURE: 'default',
  SAMPLE: 'geekblue',
};

const BUSINESS_FIELD_LABELS: Record<string, string> = {
  applicant: '发起人',
  applicantName: '发起人',
  applicantUser: '发起人',
  applicantUserId: '发起账号',
  applicantUsername: '发起账号',
  requester: '发起人',
  requesterName: '发起人',
  requesterUser: '发起人',
  requesterUserId: '发起账号',
  requesterUsername: '发起账号',
  applyUser: '申请人',
  applyUserId: '申请账号',
  applyUsername: '申请账号',
  applyEmployee: '申请人',
  applyEmployeeName: '申请人',
  submitUser: '提交人',
  submitUserId: '提交账号',
  submitUsername: '提交账号',
  submitter: '提交人',
  initiator: '发起人',
  initiatorName: '发起人',
  creator: '创建人',
  creatorName: '创建人',
  createdBy: '创建人',
  department: '所属部门',
  departmentName: '所属部门',
  dept: '所属部门',
  deptName: '所属部门',
  orgDepartment: '所属部门',
  orgDept: '所属部门',
  applyDept: '申请部门',
  applyDeptName: '申请部门',
  applyDepartment: '申请部门',
  applyDepartmentName: '申请部门',
  applicantDepartment: '申请部门',
  applicantDept: '申请部门',
  applicantDepartmentName: '申请部门',
  requesterDept: '发起部门',
  requesterDepartment: '发起部门',
  requesterDepartmentName: '发起部门',
  submitDept: '提交部门',
  submitDepartment: '提交部门',
  submitDepartmentName: '提交部门',
  startDept: '发起部门',
  startDepartment: '发起部门',
  startDepartmentName: '发起部门',
  applyUnit: '申请单位',
  applyUnitName: '申请单位',
  applicantUnit: '申请单位',
  applicantUnitName: '申请单位',
  requesterUnit: '发起单位',
  requesterUnitName: '发起单位',
  submitUnit: '提交单位',
  submitUnitName: '提交单位',
  organizationUnit: '所属组织',
  itemName: '事项名称',
  subject: '事项名称',
  amount: '金额',
  reason: '事项说明',
  expectedResult: '期望结果',
  description: '事项说明',
  remark: '备注',
  approvalUsers: '审批人',
  approvalUser: '审批人',
  approvalUserId: '审批账号',
  approver: '审批人',
  approverUser: '审批人',
  approverUserId: '审批账号',
  approvers: '审批人',
  reviewer: '复核人',
  reviewerUser: '复核人',
  reviewerUserId: '复核账号',
  reviewers: '复核人',
  assignee: '处理人',
  assigneeUser: '处理人',
  assigneeUserId: '处理账号',
  assignees: '处理人',
  handler: '处理人',
  handlerUser: '处理人',
  handlerUserId: '处理账号',
  handlers: '处理人',
  processor: '处理人',
  processorUser: '处理人',
  processorUserId: '处理账号',
  processors: '处理人',
  candidateUsers: '候选审批人',
  candidateGroup: '候选角色',
  candidateGroups: '候选角色',
  managerApprover: '第一审批人',
  financeApprover: '第二审批人',
  accepted: '审批通过',
  approvalNodeCount: '审批节点数',
  businessDescription: '事项说明',
  departmentCount: '部门数',
  reviewComment: '处理意见',
  comment: '处理意见',
  role: '角色',
  approved: '处理结论',
  decision: '处理结论',
  decisionText: '处理结论',
  opinion: '处理意见',
  businessKey: '业务编号',
  id: '编号',
  code: '结果编码',
  data: '业务数据',
  variables: '业务数据',
  workflowVariables: '业务数据',
  payload: '业务内容',
  message: '结果说明',
  requestId: '业务追踪号',
  tenantId: '组织',
  userId: '成员',
  startUserId: '发起人',
  startUserName: '发起人',
  roleCount: '角色数',
  createdAt: '创建时间',
  updatedAt: '更新时间',
  time: '时间',
  modelKey: '流程标识',
  modelName: '流程名称',
  processDefinitionKey: '流程标识',
  processDefinitionId: '运行版本',
  processInstanceId: '流程实例编号',
  deploymentId: '发布编号',
  taskId: '任务编号',
  taskDefinitionKey: '任务节点',
  taskName: '任务名称',
  jobId: '任务编号',
  activityId: '节点编号',
  executionId: '执行编号',
  elementId: '节点编号',
  elementName: '节点名称',
  handlerType: '处理器',
  handlerConfiguration: '处理器配置',
  bpmn: '流程图',
  bpmnXml: '流程图',
  formSchemaId: '表单',
  schemaJson: '表单定义',
  uiSchemaJson: '表单布局',
  schema: '表单定义',
  uiSchema: '表单布局',
  properties: '字段配置',
  required: '必填字段',
  fieldKey: '字段标识',
  fieldName: '字段名称',
  widget: '控件',
  title: '标题',
  enum: '选项',
  default: '默认值',
  minimum: '最小值',
  maximum: '最大值',
  minLength: '最短长度',
  maxLength: '最长长度',
  pattern: '格式规则',
  formKey: '表单标识',
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
  exceptionMessage: '异常信息',
  exceptionStacktrace: '异常堆栈',
  reasonMessage: '原因',
  password: '密码',
  fromVersion: '恢复版本',
  url: '请求地址',
  method: '请求方式',
  statusCode: '状态码',
  headers: '请求头',
  body: '请求体',
  requestSummary: '请求摘要',
  responseSummary: '响应摘要',
  oldValue: '调整前',
  newValue: '调整后',
  before: '调整前',
  after: '调整后',
  'X-Tenant-Id': '组织',
  'X-User-Id': '成员',
  'X-User-Role': '职责',
  'X-Koravo-Tenant-Id': '组织',
  'X-Koravo-User-Id': '成员',
  'X-Koravo-User-Role': '职责',
  'X-Koravo-Platform-Token': '平台身份凭证',
  request: '请求',
  response: '响应',
  delegateExpression: '执行表达式',
  connectorType: '连接器类型',
  connectionName: '连接名称',
  retryCount: '重试次数',
  timeout: '超时时间',
  timeoutMillis: '超时时间',
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
    collaborativeApproval: '协同审批流程',
    connectorOperations: '集成动作流程',
  };
  if (LEGACY_PROCESS_KEYS.has(modelKey || '')) return '历史流程资产';
  if (/^enterpriseApproval\d*$/i.test(modelKey || '')) {
    return '企业级审批流程';
  }
  return processNameLabel(
    mapping[modelKey || ''] || fallback || readableIdentifier(modelKey),
  );
}

export function processModelKeyLabel(modelKey?: string | null) {
  if (!modelKey) return '-';
  if (LEGACY_PROCESS_KEYS.has(modelKey)) return '历史流程资产';
  if (/^businessFlow[a-z0-9]+$/i.test(modelKey)) return '业务流程';
  return modelKey;
}

export function isBusinessProcessModel(
  model?: Pick<
    ProcessModelItem,
    'modelKey' | 'modelName' | 'description'
  > | null,
) {
  return Boolean(model);
}

export function isActiveBusinessProcessModel(
  model?: Pick<
    ProcessModelItem,
    'modelKey' | 'modelName' | 'description' | 'status'
  > | null,
) {
  return isBusinessProcessModel(model) && model?.status !== 'ARCHIVED';
}

export function processDescriptionLabel(
  model?: Pick<ProcessModelItem, 'modelKey' | 'description'> | null,
) {
  const description = model?.description?.trim();
  if (!description) {
    return processKindLabel(model?.modelKey);
  }
  return productCopy(description);
}

export function productCopy(value?: string | null) {
  if (!value) return '';
  return value
    .replaceAll('允许 localhost', '允许本地服务地址')
    .replace(
      /v\d+(?:\.\d+)*\s*未接入对象存储健康探测/g,
      '对象存储健康探测暂未启用',
    )
    .replace(/v\d+(?:\.\d+)*\s*未接入/g, '暂未接入')
    .replace(/\s+/g, ' ')
    .trim();
}

export function processNameLabel(value?: string | null) {
  const text = productCopy(value);
  if (!text) return '';
  if (/^http\s*健康检查$/i.test(text)) return '接口巡检流程';
  return text;
}

export function buildVersionLabel(value?: string | null) {
  if (!value) return '-';
  const text = String(value).trim();
  if (/snapshot|dev|local/i.test(text)) return '预发布构建';
  return text;
}

function generatedBusinessKeyLabel(value: string) {
  const match = value.match(/^(?:COLLABORATIVE-APPROVAL|REQ)-(\d{8})-(\d{6})$/);
  if (!match) return '';
  const [, date, time] = match;
  return `业务申请 ${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6, 8)} ${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}`;
}

export function businessKeyLabel(value?: string | null) {
  if (!value) return '-';
  const text = productCopy(value);
  return generatedBusinessKeyLabel(text) || text;
}

export function formSchemaNameLabel(formName?: string | null) {
  return productCopy(formName) || '-';
}

export function formSchemaKeyLabel(formKey?: string | null) {
  if (!formKey) return '-';
  if (LEGACY_FORM_KEYS.has(formKey)) return '历史表单资产';
  return formKey;
}

export function formSchemaOptionLabel(
  schema: {
    formKey?: string | null;
    formName?: string | null;
    version?: number | null;
  },
  version?: number | null,
) {
  const schemaVersion = version || schema.version || 1;
  return `${formSchemaNameLabel(schema.formName)} v${schemaVersion}`;
}

export function processKindLabel(modelKey?: string) {
  const mapping: Record<string, string> = {
    collaborativeApproval: '协同审批流程',
    connectorOperations: '集成动作流程',
  };
  return mapping[modelKey || ''] || '流程模型';
}

export function processDefinitionLabel(value?: string) {
  if (!value) return '';
  const [key, version] = value.split(':');
  const name = processDisplayName(key);
  return version ? `${name} v${version}` : name;
}

function generatedDepartmentLabel(value: string) {
  const index = Number(value);
  if (Number.isInteger(index) && index >= 1) {
    return `业务${GENERATED_DEPARTMENT_NAMES[index - 1] || index}部`;
  }
  return '业务部门';
}

function approvalStageLabel(value: string) {
  const index = Number(value);
  if (Number.isInteger(index) && index >= 1) {
    return APPROVAL_STAGE_NAMES[index - 1] || `第${index}轮审批`;
  }
  return '审批';
}

function generatedWorkflowNodeLabel(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return '';

  const departmentApproval =
    text.match(/^dept[-_]?(\d+)[-_]approval[-_]?(\d+)$/i) ||
    text.match(/^部门(\d+)审批节点(\d+)$/);
  if (departmentApproval) {
    return `${generatedDepartmentLabel(departmentApproval[1])}${approvalStageLabel(departmentApproval[2])}`;
  }

  const departmentSubProcess =
    text.match(/^dept[-_]?(\d+)[-_]sub[-_]?process(?:[-_](start|end))?$/i) ||
    text.match(/^dept[-_]?(\d+)子流程$/i) ||
    text.match(/^部门(\d+)子流程$/);
  if (departmentSubProcess) {
    const department = generatedDepartmentLabel(departmentSubProcess[1]);
    if (departmentSubProcess[2]?.toLowerCase() === 'start') {
      return `进入${department}流程`;
    }
    if (departmentSubProcess[2]?.toLowerCase() === 'end') {
      return `${department}流程完成`;
    }
    return `${department}流程`;
  }

  return '';
}

export function taskDefinitionLabel(
  key?: string,
  task?: Pick<BpmnTaskDefinition, 'name'>,
) {
  if (!key) {
    return (
      generatedWorkflowNodeLabel(task?.name) || productCopy(task?.name) || '-'
    );
  }
  const mapping: Record<string, string> = {
    approvalTask: '审批处理',
    candidateApprovalTask: '待认领审批',
    managerApprovalTask: '主管审批',
    financeApprovalTask: '财务复核',
    jointApprovalTask: '多人会签',
    businessReviewTask: '业务审批',
    financeReviewTask: '财务复核',
    reviewTask: '审批',
    Task_1: '提交申请',
    approveTask: '处理任务',
  };
  const generatedKeyLabel = generatedWorkflowNodeLabel(key);
  if (generatedKeyLabel) return generatedKeyLabel;
  const generatedNameLabel = generatedWorkflowNodeLabel(task?.name);
  if (generatedNameLabel) return generatedNameLabel;
  const taskName = productCopy(task?.name);
  if (taskName) return taskName;
  const roleApproval = key.match(/^role[-_]?(\d+)(?:Task|Approval)?$/i);
  if (roleApproval) return `审批角色 ${Number(roleApproval[1])}`;
  return mapping[key] || productCopy(task?.name) || readableIdentifier(key);
}

export function bpmnValidationIssueText(issue?: {
  code?: string;
  message?: string;
  elementId?: string;
}) {
  const node = issue?.elementId
    ? taskDefinitionLabel(issue.elementId)
    : undefined;
  const atNode = node && node !== '-' ? `：${node}` : '';
  const mapping: Record<string, string> = {
    BPMN_XML_REQUIRED: '请先保存流程图',
    BPMN_XML_INVALID: '流程文件格式不正确',
    BPMN_DEFINITIONS_MISSING: '缺少 BPMN 定义',
    BPMN_PROCESS_MISSING: '缺少流程定义',
    BPMN_PROCESS_ID_MISSING: '流程标识为空',
    BPMN_PROCESS_NOT_EXECUTABLE: '流程未设为可执行',
    BPMN_START_EVENT_MISSING: '缺少开始节点',
    BPMN_END_EVENT_MISSING: '缺少结束节点',
    BPMN_USER_TASK_ASSIGNEE_REQUIRED: `缺少办理人${atNode}`,
  };
  if (issue?.code && mapping[issue.code]) {
    return mapping[issue.code];
  }
  if (issue?.message && !/[a-z]{3,}/i.test(issue.message)) {
    return issue.message;
  }
  return issue?.code || '流程校验未通过';
}

export function normalizeBpmnXmlLabels(bpmnXml?: string) {
  if (!bpmnXml) return '';
  if (
    typeof DOMParser === 'undefined' ||
    typeof XMLSerializer === 'undefined'
  ) {
    return bpmnXml;
  }
  try {
    const document = new DOMParser().parseFromString(
      bpmnXml,
      'application/xml',
    );
    if (document.querySelector('parsererror')) return bpmnXml;
    Array.from(document.getElementsByTagName('*')).forEach((element) => {
      const label =
        generatedWorkflowNodeLabel(element.getAttribute('id')) ||
        generatedWorkflowNodeLabel(element.getAttribute('name'));
      if (label) {
        element.setAttribute('name', label);
      }
    });
    return new XMLSerializer().serializeToString(document);
  } catch {
    return bpmnXml;
  }
}

export function taskNameLabel(task?: {
  name?: string | null;
  taskDefinitionKey?: string | null;
}) {
  if (!task) return '-';
  if (task.taskDefinitionKey)
    return taskDefinitionLabel(task.taskDefinitionKey);
  return productCopy(task.name) || '-';
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

export function genericStatusLabel(value?: string | null) {
  return auditCodeLabel(value, GENERIC_STATUS_LABELS);
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

export function assetOriginLabel(value?: string | null) {
  return auditCodeLabel(value, ASSET_ORIGIN_LABELS);
}

export function assetOriginColor(value?: string | null) {
  if (!value) return 'default';
  return ASSET_ORIGIN_COLORS[value] || 'default';
}

export function connectionAddressLabel(value?: string | null) {
  if (!value) return '-';
  const text = String(value);
  const normalized = text.toLowerCase();
  const isLocalAddress =
    /(^|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/.test(normalized) ||
    /(^|@)(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/.test(normalized);

  if (!isLocalAddress) return text;
  if (/\/health\b|\/actuator\/health\b/.test(normalized))
    return '本地服务健康检查';
  if (normalized.startsWith('jdbc:')) return '本地数据源连接';
  return '本地服务地址';
}

export function shortTraceLabel(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return '';
  const text = String(value);
  return text.length > 12 ? text.slice(0, 8) : text;
}

export function businessFieldLabel(value?: string | null) {
  if (!value) return '-';
  const roleUser = value.match(/^role(\d+)[_-]?User$/i);
  if (roleUser) return `流程角色 ${roleUser[1]}`;
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
