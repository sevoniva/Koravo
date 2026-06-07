import { apiData, http } from './http'
import type {
  BpmnTaskDefinition,
  DashboardSummary,
  OpsJobItem,
  OpsSummary,
  SystemHealth
} from '../types/koravo'

export type {
  BpmnTaskDefinition,
  DashboardSummary,
  OpsJobItem,
  OpsSummary,
  SystemHealth
} from '../types/koravo'

export type JsonRecord = Record<string, unknown>

export interface HealthInfo {
  status: string
  version: string
  time: string
  tenantId: string
  userId: string
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

export interface DemoStepStatus {
  ready: boolean
  status: string
  message: string
  resourceId?: string
  count: number
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

export interface TaskListParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  startTime?: string
  endTime?: string
}

export function getHealth() {
  return apiData<HealthInfo>(http.get('/health'))
}

export function getSystemHealth() {
  return apiData<SystemHealth>(http.get('/system/health'))
}

export function getDashboardSummary() {
  return apiData<DashboardSummary>(http.get('/dashboard/summary'))
}

export function getDemoStatus() {
  return apiData<DemoStatus>(http.get('/demo/status'))
}

export function initDemoData() {
  return apiData<DemoInitResult>(http.post('/demo/init'))
}

export function deployProcessModel(modelName: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return apiData<ProcessDeployment>(http.post(`/process-models/deploy?modelName=${encodeURIComponent(modelName)}`, formData))
}

export function listProcessModels(status?: string) {
  return apiData<ProcessModelItem[]>(http.get('/process-models', { params: { status } }))
}

export function getProcessModel(id: string) {
  return apiData<ProcessModelItem>(http.get(`/process-models/${id}`))
}

export function listProcessModelTaskDefinitions(id: string) {
  return apiData<BpmnTaskDefinition[]>(http.get(`/process-models/${id}/task-definitions`))
}

export function createProcessModel(payload: {
  modelKey: string
  modelName: string
  description?: string
  bpmnXml?: string
}) {
  return apiData<ProcessModelItem>(http.post('/process-models', payload))
}

export function importProcessModel(payload: {
  modelName: string
  description?: string
  bpmnXml: string
}) {
  return apiData<ProcessModelItem>(http.post('/process-models/import', payload))
}

export function updateProcessModel(id: string, payload: {
  modelName: string
  description?: string
  bpmnXml: string
}) {
  return apiData<ProcessModelItem>(http.put(`/process-models/${id}`, payload))
}

export function validateProcessModelXml(bpmnXml: string) {
  return apiData<BpmnValidationResult>(http.post('/process-models/validate', bpmnXml, {
    headers: { 'Content-Type': 'text/plain' }
  }))
}

export function validateProcessModel(id: string) {
  return apiData<BpmnValidationResult>(http.post(`/process-models/${id}/validate`))
}

export function deployProcessModelDraft(id: string) {
  return apiData<ProcessModelDeployResult>(http.post(`/process-models/${id}/deploy`))
}

export function disableProcessModel(id: string) {
  return apiData<ProcessModelItem>(http.post(`/process-models/${id}/disable`))
}

export function archiveProcessModel(id: string) {
  return apiData<ProcessModelItem>(http.post(`/process-models/${id}/archive`))
}

export async function exportProcessModel(id: string) {
  const response = await http.get(`/process-models/${id}/export`, { responseType: 'blob' })
  return response.data as Blob
}

export function startProcessInstance(payload: { processDefinitionKey: string; businessKey: string; variables: JsonRecord }) {
  return apiData<ProcessInstance>(http.post('/process-instances/start', payload))
}

export function getProcessInstance(instanceId: string) {
  return apiData<OpsProcessInstance>(http.get(`/process-instances/${instanceId}`))
}

export function listTasks(params?: TaskListParams) {
  return apiData<PageResult<TaskItem>>(http.get('/tasks/my', { params }))
}

export function listDoneTasks(params?: TaskListParams) {
  return apiData<PageResult<TaskItem>>(http.get('/tasks/done', { params }))
}

export function listStartedInstances(params?: TaskListParams) {
  return apiData<PageResult<OpsProcessInstance>>(http.get('/tasks/started', { params }))
}

export function getTaskDetail(taskId: string) {
  return apiData<TaskDetail>(http.get(`/tasks/${taskId}`))
}

export function completeTask(taskId: string, payload: {
  variables: JsonRecord
  formData?: JsonRecord
  formSchemaId?: string
  comment?: string
}) {
  return apiData(http.post(`/tasks/${taskId}/complete`, payload))
}

export function listFormSchemas() {
  return apiData<FormSchemaItem[]>(http.get('/forms/schemas'))
}

export function createFormSchema(payload: {
  formKey: string
  formName: string
  schemaJson: string
  uiSchemaJson?: string
}) {
  return apiData<FormSchemaItem>(http.post('/forms/schemas', payload))
}

export function updateFormSchema(id: string, payload: {
  formKey: string
  formName: string
  schemaJson: string
  uiSchemaJson?: string
}) {
  return apiData<FormSchemaItem>(http.put(`/forms/schemas/${id}`, payload))
}

export function getFormSchema(id: string) {
  return apiData<FormSchemaItem>(http.get(`/forms/schemas/${id}`))
}

export function listFormBindings(params?: { processModelId?: string; processDefinitionId?: string }) {
  return apiData<FormBindingItem[]>(http.get('/form-bindings', { params }))
}

export function createFormBinding(payload: {
  processModelId?: string
  processDefinitionId?: string
  taskDefinitionKey: string
  formSchemaId: string
  formSchemaVersion: number
}) {
  return apiData<FormBindingItem>(http.post('/form-bindings', payload))
}

export function updateFormBinding(id: string, payload: {
  processModelId?: string
  processDefinitionId?: string
  taskDefinitionKey: string
  formSchemaId: string
  formSchemaVersion: number
}) {
  return apiData<FormBindingItem>(http.put(`/form-bindings/${id}`, payload))
}

export function deleteFormBinding(id: string) {
  return apiData(http.delete(`/form-bindings/${id}`))
}

export function createDataSource(payload: JsonRecord) {
  return apiData<DataSourceItem>(http.post('/datasources', payload))
}

export function updateDataSource(id: string, payload: JsonRecord) {
  return apiData<DataSourceItem>(http.put(`/datasources/${id}`, payload))
}

export function deleteDataSource(id: string) {
  return apiData(http.delete(`/datasources/${id}`))
}

export function listDataSources() {
  return apiData<DataSourceItem[]>(http.get('/datasources'))
}

export function getDataSource(id: string) {
  return apiData<DataSourceItem>(http.get(`/datasources/${id}`))
}

export function testDataSource(id: string) {
  return apiData<DataSourceTestResult>(http.post(`/datasources/${id}/test`))
}

export function listDataSourceTestLogs(id: string, params?: { page?: number; pageSize?: number }) {
  return apiData<PageResult<DataSourceTestLogItem>>(http.get(`/datasources/${id}/test-logs`, { params }))
}

export function listAuditLogs(params: {
  userId?: string
  action?: string
  resourceType?: string
  resourceId?: string
  requestId?: string
  startTime?: string
  endTime?: string
  page?: number
  pageSize?: number
}) {
  return apiData<PageResult<AuditLogItem>>(http.get('/audit-logs', { params }))
}

export function listOpsInstances(params?: { page?: number; pageSize?: number }) {
  return apiData<PageResult<OpsProcessInstance>>(http.get('/ops/process-instances', { params }))
}

export function listOpsCapabilities() {
  return apiData<OpsCapabilityItem[]>(http.get('/ops/capabilities'))
}

export function getOpsSummary() {
  return apiData<OpsSummary>(http.get('/ops/summary'))
}

export function listFailedJobs(params?: { page?: number; pageSize?: number }) {
  return apiData<PageResult<OpsJobItem>>(http.get('/ops/failed-jobs', { params }))
}

export function getFailedJob(jobId: string) {
  return apiData<OpsJobItem>(http.get(`/ops/failed-jobs/${jobId}`))
}

export function retryFailedJob(jobId: string, retries = 3) {
  return apiData(http.post(`/ops/failed-jobs/${jobId}/retry`, { retries }))
}

export function deleteFailedJob(jobId: string) {
  return apiData(http.post(`/ops/failed-jobs/${jobId}/delete`))
}

export function listDeadLetterJobs(params?: { page?: number; pageSize?: number }) {
  return apiData<PageResult<OpsJobItem>>(http.get('/ops/dead-letter-jobs', { params }))
}

export function getDeadLetterJob(jobId: string) {
  return apiData<OpsJobItem>(http.get(`/ops/dead-letter-jobs/${jobId}`))
}

export function retryDeadLetterJob(jobId: string, retries = 3) {
  return apiData(http.post(`/ops/dead-letter-jobs/${jobId}/retry`, { retries }))
}

export function deleteDeadLetterJob(jobId: string) {
  return apiData(http.post(`/ops/dead-letter-jobs/${jobId}/delete`))
}

export function getOpsInstance(instanceId: string) {
  return apiData<OpsProcessInstance>(http.get(`/ops/process-instances/${instanceId}`))
}

export function getProcessTrace(instanceId: string) {
  return apiData<ProcessTrace>(http.get(`/ops/process-instances/${instanceId}/trace`))
}

export function terminateProcessInstance(instanceId: string, reason: string) {
  return apiData(http.post(`/ops/process-instances/${instanceId}/terminate`, { reason }))
}

export function suspendProcessInstance(instanceId: string) {
  return apiData(http.post(`/ops/process-instances/${instanceId}/suspend`))
}

export function activateProcessInstance(instanceId: string) {
  return apiData(http.post(`/ops/process-instances/${instanceId}/activate`))
}

export function listConnectorExecutionLogs(params: {
  connectorType?: string
  status?: string
  requestId?: string
  page?: number
  pageSize?: number
}) {
  return apiData<PageResult<ConnectorExecutionLogItem>>(http.get('/connector-execution-logs', { params }))
}

export function getConnectorExecutionSummary(connectorType?: string) {
  return apiData<ConnectorExecutionSummary>(http.get('/connector-execution-logs/summary', { params: { connectorType } }))
}

export function getConnectorExecutionLog(id: string) {
  return apiData<ConnectorExecutionLogItem>(http.get(`/connector-execution-logs/${id}`))
}
