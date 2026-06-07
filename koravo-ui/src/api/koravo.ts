import { apiData, http } from './http'

export type JsonRecord = Record<string, unknown>

export interface HealthInfo {
  status: string
  version: string
  time: string
  tenantId: string
  userId: string
}

export interface ProcessDeployment {
  platformModelId: string
  deploymentId: string
  processDefinitionId: string
  processDefinitionKey: string
  version: number
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
  currentActivityIds: string[]
  currentTasks: TaskItem[]
  timeline: ProcessTraceNode[]
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

export interface TaskDetail {
  task: TaskItem
  formBinding?: FormBindingItem
  formSchema?: FormSchemaItem
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

export function getHealth() {
  return apiData<HealthInfo>(http.get('/health'))
}

export function deployProcessModel(modelName: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return apiData<ProcessDeployment>(http.post(`/process-models/deploy?modelName=${encodeURIComponent(modelName)}`, formData))
}

export function startProcessInstance(payload: { processDefinitionKey: string; businessKey: string; variables: JsonRecord }) {
  return apiData<ProcessInstance>(http.post('/process-instances/start', payload))
}

export function getProcessInstance(instanceId: string) {
  return apiData(http.get(`/process-instances/${instanceId}`))
}

export function listTasks() {
  return apiData<PageResult<TaskItem>>(http.get('/tasks/my?page=1&pageSize=20'))
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

export function listFormBindings(processModelId?: string) {
  const query = processModelId ? `?processModelId=${encodeURIComponent(processModelId)}` : ''
  return apiData<FormBindingItem[]>(http.get(`/form-bindings${query}`))
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

export function createDataSource(payload: JsonRecord) {
  return apiData<DataSourceItem>(http.post('/datasources', payload))
}

export function listDataSources() {
  return apiData<DataSourceItem[]>(http.get('/datasources'))
}

export function testDataSource(id: string) {
  return apiData(http.post(`/datasources/${id}/test`))
}

export function listDataSourceTestLogs(id: string) {
  return apiData<PageResult<DataSourceTestLogItem>>(http.get(`/datasources/${id}/test-logs?page=1&pageSize=10`))
}

export function listAuditLogs(params: {
  userId?: string
  action?: string
  resourceType?: string
  page?: number
  pageSize?: number
}) {
  return apiData<PageResult<AuditLogItem>>(http.get('/audit-logs', { params }))
}

export function listOpsInstances() {
  return apiData<PageResult<unknown>>(http.get('/ops/process-instances?page=1&pageSize=20'))
}

export function getOpsInstance(instanceId: string) {
  return apiData(http.get(`/ops/process-instances/${instanceId}`))
}

export function getProcessTrace(instanceId: string) {
  return apiData<ProcessTrace>(http.get(`/ops/process-instances/${instanceId}/trace`))
}

export function listConnectorExecutionLogs(params: {
  connectorType?: string
  status?: string
  page?: number
  pageSize?: number
}) {
  return apiData<PageResult<ConnectorExecutionLogItem>>(http.get('/connector-execution-logs', { params }))
}
