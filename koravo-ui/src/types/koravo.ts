export type JsonRecord = Record<string, unknown>

export interface HealthInfo {
  status: string
  version: string
  time: string
  tenantId: string
  userId: string
}

export interface SystemHealthItem {
  key: string
  name: string
  status: string
  message: string
}

export interface SystemHealth {
  status: string
  version: string
  time: string
  tenantId: string
  userId: string
  dependencies: SystemHealthItem[]
  demoMode: {
    enabled: boolean
    message: string
  }
  urlPolicy: {
    localhostAllowed: boolean
    privateNetworkAllowed: boolean
    publicHttpsRequired: boolean
    message: string
  }
}

export interface DemoStepStatus {
  ready: boolean
  status: string
  message: string
  resourceId?: string
  count: number
}

export interface DemoStatus {
  initialized: boolean
  tenantId: string
  userId: string
  processModelId?: string
  processDefinitionId?: string
  processDefinitionKey: string
  formSchemaId?: string
  formBindingId?: string
  message: string
  process?: DemoStepStatus
  form?: DemoStepStatus
  binding?: DemoStepStatus
  todo?: DemoStepStatus
  audit?: DemoStepStatus
  connector?: DemoStepStatus
  defaultStartVariables?: JsonRecord
}

export interface DemoInitResult {
  initialized: boolean
  processModelId?: string
  processDefinitionId?: string
  processDefinitionKey: string
  formSchemaId?: string
  formBindingId?: string
  actions: string[]
}

export interface ProcessDeployment {
  platformModelId: string
  deploymentId: string
  processDefinitionId: string
  processDefinitionKey: string
  version: number
}

export interface ProcessModelItem {
  id: string
  tenantId: string
  modelKey: string
  modelName: string
  modelType: string
  version: number
  flowableDeploymentId?: string
  flowableDefinitionId?: string
  status: string
  description?: string
  bpmnXml?: string
  createdAt?: string
  updatedAt?: string
}

export interface BpmnTaskDefinition {
  taskDefinitionKey: string
  name?: string
  type: string
  assignee?: string
}

export interface BpmnValidationIssue {
  code: string
  message: string
  elementId?: string
}

export interface BpmnValidationResult {
  valid: boolean
  errors: BpmnValidationIssue[]
  warnings: BpmnValidationIssue[]
}

export interface ProcessModelDeployResult {
  model: ProcessModelItem
  deployment: ProcessDeployment
}

export interface ProcessInstance {
  instanceId: string
  processDefinitionId: string
  businessKey: string
  status: string
}

export interface ProcessTraceNode {
  activityId: string
  activityName?: string
  activityType: string
  startTime?: string
  endTime?: string
  status: string
}

export interface ProcessTrace {
  instanceId: string
  processDefinitionId: string
  businessKey: string
  status: string
  bpmnXml?: string
  variables: JsonRecord
  currentActivityIds: string[]
  currentTasks: TaskItem[]
  timeline: ProcessTraceNode[]
}

export interface OpsProcessInstance {
  instanceId: string
  processDefinitionId: string
  businessKey?: string
  startUserId?: string
  startTime?: string
  endTime?: string
  status: string
  currentTasks: TaskItem[]
  auditLogs?: AuditLogItem[]
}

export interface TaskItem {
  taskId: string
  name: string
  processInstanceId: string
  processDefinitionId: string
  businessKey: string
  createTime: string
  assignee: string
  taskDefinitionKey: string
  status: string
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface DataSourceItem {
  id: string
  name: string
  type: string
  jdbcUrl: string
  username: string
  driverClassName: string
  readOnly: boolean
  poolConfigJson: string
  status: string
}

export interface FormSchemaItem {
  id: string
  formKey: string
  formName: string
  version: number
  schemaJson: string
  uiSchemaJson?: string
  status: string
}

export interface FormBindingItem {
  id: string
  processModelId?: string
  processDefinitionId?: string
  taskDefinitionKey: string
  formSchemaId: string
  formSchemaVersion: number
}

export interface TaskCommentItem {
  id: string
  userId?: string
  message?: string
  time?: string
}

export interface FormSnapshotItem {
  id: string
  processInstanceId: string
  taskId?: string
  formSchemaId: string
  formSchemaVersion?: number
  schemaJson?: string
  uiSchemaJson?: string
  dataJson: string
  createdAt?: string
}

export interface TaskDetail {
  task: TaskItem
  formBinding?: FormBindingItem
  formSchema?: FormSchemaItem
  processVariables: JsonRecord
  taskVariables: JsonRecord
  comments: TaskCommentItem[]
  formSnapshots: FormSnapshotItem[]
  auditLogs: AuditLogItem[]
}

export interface AuditLogItem {
  id: string
  tenantId: string
  userId: string
  action: string
  resourceType: string
  resourceId?: string
  requestId?: string
  clientIp?: string
  detailJson?: string
  createdAt: string
}

export interface DataSourceTestLogItem {
  id: string
  datasourceId: string
  success: boolean
  message?: string
  elapsedMillis: number
  createdAt: string
}

export interface DataSourceTestResult {
  success: boolean
  message?: string
  elapsedMillis: number
}

export interface ConnectorExecutionLogItem {
  id: string
  connectorType: string
  method?: string
  url?: string
  status: string
  statusCode?: number
  elapsedMillis: number
  requestId?: string
  requestSummary?: string
  responseSummary?: string
  errorMessage?: string
  createdAt: string
}

export interface ConnectorExecutionSummary {
  total: number
  success: number
  failed: number
  recentFailures: ConnectorExecutionLogItem[]
}

export interface OpsCapabilityItem {
  key: string
  name: string
  status: string
  description: string
}

export interface OpsJobItem {
  id: string
  type: string
  tenantId: string
  processInstanceId?: string
  processDefinitionId?: string
  executionId?: string
  elementId?: string
  elementName?: string
  handlerType?: string
  handlerConfiguration?: string
  retries: number
  exceptionMessage?: string
  exceptionStacktrace?: string
  dueDate?: string
  createTime?: string
}

export interface OpsSummary {
  runningInstanceCount: number
  failedJobCount: number
  deadLetterJobCount: number
  connectorFailureCount: number
  exceptions: Array<{
    key: string
    name: string
    status: string
    count: number
    message: string
  }>
}

export interface DashboardSummary {
  tenantId: string
  userId: string
  healthStatus: string
  version: string
  time: string
  processModelCount: number
  deployedProcessModelCount: number
  runningInstanceCount: number
  myTodoCount: number
  todayCompletedCount: number
  connectorSuccessCount: number
  connectorFailedCount: number
  failedJobCount: number
  deadLetterJobCount: number
  recentAuditLogs: AuditLogItem[]
  connectorSummary: ConnectorExecutionSummary
}
