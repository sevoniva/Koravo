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

export interface TaskItem {
  taskId: string
  name: string
  processInstanceId: string
  processDefinitionId: string
  businessKey: string
  createTime: string
  assignee: string
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

export function completeTask(taskId: string, variables: JsonRecord) {
  return apiData(http.post(`/tasks/${taskId}/complete`, { variables }))
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

export function listOpsInstances() {
  return apiData<PageResult<unknown>>(http.get('/ops/process-instances?page=1&pageSize=20'))
}

export function getOpsInstance(instanceId: string) {
  return apiData(http.get(`/ops/process-instances/${instanceId}`))
}
