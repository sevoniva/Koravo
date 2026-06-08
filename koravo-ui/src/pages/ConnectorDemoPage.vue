<template>
  <PageContainer>
    <PageHeader title="HTTP 连接器" description="健康检查与执行日志。">
      <template #actions>
        <a-button :loading="initLoading" @click="prepareConnectorFlow"><ThunderboltOutlined />准备流程</a-button>
        <a-button type="primary" :loading="startLoading" @click="startHealthCheck"><PlayCircleOutlined />发起健康检查</a-button>
        <a-button @click="router.push('/ops?tab=connectors')"><ApiOutlined />执行日志</a-button>
      </template>
    </PageHeader>

    <a-alert
      :type="error ? 'error' : processModel ? 'success' : 'info'"
      show-icon
      :message="error || statusMessage"
      description="响应写入流程变量。"
    />

    <div class="connector-result-grid compact-metric-grid panel-block">
      <MetricCard label="流程状态" :value="processModelStatusText" :status="processModel?.status" :description="processModelDescription" />
      <MetricCard label="调用目标" value="GET /api/v1/health" description="本机服务" />
      <MetricCard label="最近执行" :value="latestExecutionText" :status="latestLog?.status" :description="latestExecutionDescription" />
    </div>

    <div class="two-column-grid">
      <DetailSection title="流程结果">
        <a-alert
          v-if="resultVariableName !== '-'"
          show-icon
          :type="resultAlertType"
          :message="resultSummaryTitle"
          :description="resultSummaryDescription"
        />
        <EmptyState v-else description="启动后显示结果" />
        <a-descriptions :column="1" bordered size="small">
          <a-descriptions-item label="实例">{{ instanceId || '-' }}</a-descriptions-item>
          <a-descriptions-item label="状态"><StatusTag :status="trace?.status" /></a-descriptions-item>
          <a-descriptions-item label="当前任务">{{ currentTaskText }}</a-descriptions-item>
          <a-descriptions-item label="返回变量">{{ resultVariableLabel }}</a-descriptions-item>
          <a-descriptions-item label="HTTP 状态">{{ resultStatusCode }}</a-descriptions-item>
          <a-descriptions-item label="服务状态">{{ serviceStatusText }}</a-descriptions-item>
          <a-descriptions-item label="响应时间">{{ responseTimeText }}</a-descriptions-item>
        </a-descriptions>
        <a-space class="panel-block" wrap>
          <a-button :disabled="!instanceId" @click="router.push(`/process-instances/${instanceId}`)">流程追踪</a-button>
          <a-button :disabled="!currentTaskId" @click="router.push(`/tasks/${currentTaskId}`)">后续任务</a-button>
          <a-button :loading="logLoading" @click="loadLogs">刷新日志</a-button>
        </a-space>
        <a-collapse v-if="resultVariableName !== '-'" class="panel-block">
          <a-collapse-panel key="result" header="原始结果">
            <JsonPreview :value="maskedResultVariable" />
          </a-collapse-panel>
        </a-collapse>
      </DetailSection>

      <DetailSection title="最近日志">
        <EmptyState v-if="!logs.length" description="暂无连接器日志" />
        <a-table
          v-else
          :data-source="logs"
          :columns="columns"
          row-key="id"
          size="small"
          :pagination="false"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <StatusTag :status="record.status" />
            </template>
            <template v-else-if="column.key === 'elapsedMillis'">
              {{ formatDuration(record.elapsedMillis) }}
            </template>
            <template v-else-if="column.key === 'createdAt'">
              {{ formatDateTime(record.createdAt) }}
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button size="small" @click="openLog(record)">查看</a-button>
            </template>
          </template>
        </a-table>
      </DetailSection>
    </div>

    <a-modal v-model:open="logOpen" title="连接器日志" width="760px" :footer="null">
      <a-descriptions v-if="selectedLog" :column="1" bordered size="small">
        <a-descriptions-item label="时间">{{ formatDateTime(selectedLog.createdAt) }}</a-descriptions-item>
        <a-descriptions-item label="状态"><StatusTag :status="selectedLog.status" /></a-descriptions-item>
        <a-descriptions-item label="HTTP">{{ selectedLog.method }} {{ selectedLog.statusCode || '-' }}</a-descriptions-item>
        <a-descriptions-item label="耗时">{{ formatDuration(selectedLog.elapsedMillis) }}</a-descriptions-item>
        <a-descriptions-item label="URL">{{ selectedLog.url }}</a-descriptions-item>
      </a-descriptions>
      <a-alert
        v-if="selectedLog"
        class="panel-block"
        show-icon
        :type="selectedLog.status === 'SUCCESS' ? 'success' : 'error'"
        :message="selectedLogSummaryTitle"
        :description="selectedLogSummaryDescription"
      />
      <a-collapse v-if="selectedLog" class="panel-block">
        <a-collapse-panel key="detail" header="原始日志">
          <a-tabs>
            <a-tab-pane key="request" tab="请求摘要">
              <p class="log-summary-text">{{ maskedLogText(selectedLog.requestSummary) }}</p>
            </a-tab-pane>
            <a-tab-pane key="response" tab="响应摘要">
              <p class="log-summary-text">{{ maskedLogText(selectedLog.responseSummary) }}</p>
            </a-tab-pane>
            <a-tab-pane key="raw" tab="原始日志">
              <JsonPreview :value="maskedSelectedLog" />
            </a-tab-pane>
          </a-tabs>
        </a-collapse-panel>
      </a-collapse>
    </a-modal>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { ApiOutlined, PlayCircleOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import JsonPreview from '../components/JsonPreview.vue'
import {
  deployProcessModelDraft,
  getProcessTrace,
  importProcessModel,
  listConnectorExecutionLogs,
  listProcessModels,
  startProcessInstance,
  type ConnectorExecutionLogItem,
  type ProcessModelItem,
  type ProcessTrace
} from '../api/koravo'
import { DetailSection, EmptyState, MetricCard, PageContainer, PageHeader, StatusTag } from '../components/ui'
import { useSessionStore } from '../stores/session'
import { formatDateTime, formatDuration, maskSecret, parseJsonSafe } from '../utils/format'

const router = useRouter()
const session = useSessionStore()
const initLoading = ref(false)
const startLoading = ref(false)
const logLoading = ref(false)
const processModel = ref<ProcessModelItem | null>(null)
const trace = ref<ProcessTrace | null>(null)
const logs = ref<ConnectorExecutionLogItem[]>([])
const selectedLog = ref<ConnectorExecutionLogItem | null>(null)
const logOpen = ref(false)
const error = ref('')
const requestId = ref('')
const instanceId = ref('')

const columns = [
  { title: '状态', key: 'status', width: 90 },
  { title: '方法', dataIndex: 'method', key: 'method', width: 90 },
  { title: 'HTTP', dataIndex: 'statusCode', key: 'statusCode', width: 90 },
  { title: '耗时', key: 'elapsedMillis', width: 100 },
  { title: '时间', key: 'createdAt' },
  { title: '操作', key: 'action', width: 80 }
]

const statusMessage = computed(() => {
  if (!processModel.value) return 'HTTP 连接器流程未准备'
  return processModel.value.status === 'DEPLOYED' ? 'HTTP 连接器流程已部署' : 'HTTP 连接器流程待部署'
})

const processModelStatusText = computed(() => {
  if (!processModel.value) return '未准备'
  return processModel.value.status === 'DEPLOYED' ? '已部署' : '待部署'
})
const processModelDescription = computed(() => processModel.value ? `HTTP 连接器流程 v${processModel.value.version}` : '点击准备流程')
const latestLog = computed(() => logs.value[0] || null)
const latestExecutionText = computed(() => latestLog.value ? `${latestLog.value.statusCode || '-'} · ${formatDuration(latestLog.value.elapsedMillis)}` : '-')
const latestExecutionDescription = computed(() => latestLog.value ? formatDateTime(latestLog.value.createdAt) : '暂无执行记录')
const currentTaskId = computed(() => trace.value?.currentTasks?.[0]?.taskId || '')
const currentTaskText = computed(() => trace.value?.currentTasks?.map((item) => item.name).join('、') || '-')
const resultVariableName = computed(() => {
  const variables = trace.value?.variables || {}
  if ('httpResult' in variables) return 'httpResult'
  if ('healthResult' in variables) return 'healthResult'
  return '-'
})
const resultVariable = computed(() => {
  const variables = trace.value?.variables || {}
  return variables.httpResult || variables.healthResult || {}
})
const maskedResultVariable = computed(() => maskSecret(resultVariable.value))
const resultRecord = computed(() => asRecord(resultVariable.value))
const resultBody = computed(() => parseBodyPayload(resultRecord.value?.body))
const healthData = computed(() => asRecord(resultBody.value?.data) || resultBody.value || {})
const resultVariableLabel = computed(() => resultVariableName.value === 'httpResult' ? 'HTTP 调用结果' : resultVariableName.value)
const resultStatusCode = computed(() => String(resultRecord.value?.statusCode || '-'))
const serviceStatus = computed(() => String(healthData.value.status || '-'))
const serviceStatusText = computed(() => serviceStatus.value === 'UP' ? '正常' : serviceStatus.value)
const responseTimeText = computed(() => formatDateTime(String(healthData.value.time || '')))
const resultAlertType = computed(() => Number(resultRecord.value?.statusCode) >= 200 && Number(resultRecord.value?.statusCode) < 300 ? 'success' : 'warning')
const resultSummaryTitle = computed(() => {
  if (resultVariableName.value === '-') return '尚未产生返回变量'
  if (resultAlertType.value === 'success') return '健康检查正常'
  return `HTTP ${resultStatusCode.value}`
})
const resultSummaryDescription = computed(() => {
  if (resultVariableName.value === '-') return '启动后展示结果。'
  const version = healthData.value.version ? `版本 ${healthData.value.version}` : '未返回版本'
  const tenant = healthData.value.tenantId ? `租户 ${healthData.value.tenantId}` : '未返回租户'
  return `${version}，${tenant}。`
})
const maskedSelectedLog = computed(() => selectedLog.value ? maskSecret(selectedLog.value) : {})
const selectedLogBody = computed(() => extractResponseBody(selectedLog.value?.responseSummary))
const selectedLogHealthData = computed(() => asRecord(selectedLogBody.value?.data) || selectedLogBody.value || {})
const selectedLogSummaryTitle = computed(() => {
  if (!selectedLog.value) return ''
  if (selectedLog.value.errorMessage) return '调用失败'
  if (selectedLog.value.statusCode) return `HTTP ${selectedLog.value.statusCode}`
  return selectedLog.value.status
})
const selectedLogSummaryDescription = computed(() => {
  if (!selectedLog.value) return ''
  if (selectedLog.value.errorMessage) return maskedLogText(selectedLog.value.errorMessage)
  const status = selectedLogHealthData.value.status === 'UP' ? '服务正常' : `服务状态 ${selectedLogHealthData.value.status || '-'}`
  const version = selectedLogHealthData.value.version ? `版本 ${selectedLogHealthData.value.version}` : '未返回版本'
  return `${status}，${version}。`
})

async function prepareConnectorFlow() {
  initLoading.value = true
  error.value = ''
  try {
    processModel.value = await ensureModel()
    message.success('HTTP 连接器流程已就绪')
  } catch (nextError: any) {
    error.value = nextError?.message || '准备流程失败'
  } finally {
    initLoading.value = false
  }
}

async function startHealthCheck() {
  startLoading.value = true
  error.value = ''
  try {
    processModel.value = await ensureModel()
    requestId.value = `http-call-${Date.now()}`
    session.setRequestId(requestId.value)
    const instance = await startProcessInstance({
      processDefinitionKey: 'httpConnectorDemo',
      businessKey: `HTTP-${Date.now()}`,
      variables: {
        approver: session.userId || 'admin'
      }
    })
    instanceId.value = instance.instanceId
    trace.value = await getProcessTrace(instance.instanceId)
    await loadLogs()
    message.success('HTTP 健康检查流程已启动')
  } catch (nextError: any) {
    error.value = nextError?.message || '启动失败，请检查后端服务和连接器配置'
  } finally {
    startLoading.value = false
  }
}

async function loadLogs() {
  logLoading.value = true
  try {
    const page = await listConnectorExecutionLogs({
      connectorType: 'http',
      requestId: requestId.value || undefined,
      page: 1,
      pageSize: 8
    })
    logs.value = page.items
  } finally {
    logLoading.value = false
  }
}

function openLog(record: ConnectorExecutionLogItem) {
  selectedLog.value = record
  logOpen.value = true
}

async function ensureModel() {
  const models = await listProcessModels()
  const existing = models.find((item) => item.modelKey === 'httpConnectorDemo')
  if (existing?.status === 'DEPLOYED') {
    return existing
  }
  const draft = existing || await importProcessModel({
    modelName: 'HTTP 健康检查流程',
    description: '调用 Koravo 健康检查接口，并保存返回变量。',
    bpmnXml: httpConnectorDemoBpmn
  })
  const deployed = await deployProcessModelDraft(draft.id)
  return deployed.model
}

onMounted(async () => {
  const models = await listProcessModels()
  processModel.value = models.find((item) => item.modelKey === 'httpConnectorDemo') || null
  await loadLogs()
})

const httpConnectorDemoBpmn = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:flowable="http://flowable.org/bpmn"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI"
             targetNamespace="https://koravo.io/examples">
  <process id="httpConnectorDemo" name="HTTP 健康检查流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow_start_http" sourceRef="start" targetRef="callKoravoHealth"/>
    <serviceTask id="callKoravoHealth" name="调用健康检查" flowable:delegateExpression="\${koravoConnectorDelegate}">
      <extensionElements>
        <flowable:field name="connectorType" stringValue="http"/>
        <flowable:field name="method" stringValue="GET"/>
        <flowable:field name="url" stringValue="http://localhost:8080/api/v1/health"/>
        <flowable:field name="headers" stringValue="{&quot;X-Tenant-Id&quot;:&quot;default&quot;,&quot;X-User-Id&quot;:&quot;admin&quot;}"/>
        <flowable:field name="timeoutMillis" stringValue="3000"/>
        <flowable:field name="outputVariable" stringValue="httpResult"/>
      </extensionElements>
    </serviceTask>
    <sequenceFlow id="flow_http_review" sourceRef="callKoravoHealth" targetRef="reviewTask"/>
    <userTask id="reviewTask" name="确认调用结果" flowable:assignee="\${approver}"/>
    <sequenceFlow id="flow_review_end" sourceRef="reviewTask" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_httpConnectorDemo">
    <bpmndi:BPMNPlane id="BPMNPlane_httpConnectorDemo" bpmnElement="httpConnectorDemo">
      <bpmndi:BPMNShape id="Shape_start" bpmnElement="start"><omgdc:Bounds x="80" y="100" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_callKoravoHealth" bpmnElement="callKoravoHealth"><omgdc:Bounds x="170" y="78" width="150" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_reviewTask" bpmnElement="reviewTask"><omgdc:Bounds x="390" y="78" width="150" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_end" bpmnElement="end"><omgdc:Bounds x="610" y="100" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Edge_flow_start_http" bpmnElement="flow_start_http"><omgdi:waypoint x="116" y="118"/><omgdi:waypoint x="170" y="118"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_flow_http_review" bpmnElement="flow_http_review"><omgdi:waypoint x="320" y="118"/><omgdi:waypoint x="390" y="118"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_flow_review_end" bpmnElement="flow_review_end"><omgdi:waypoint x="540" y="118"/><omgdi:waypoint x="610" y="118"/></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function parseBodyPayload(value: unknown) {
  if (!value) return null
  if (typeof value === 'string') return asRecord(parseJsonSafe(value, {}))
  return asRecord(value)
}

function extractResponseBody(summary?: string) {
  if (!summary) return null
  const bodyIndex = summary.indexOf('body=')
  if (bodyIndex < 0) return null
  return parseBodyPayload(summary.slice(bodyIndex + 5))
}

function maskedLogText(value?: string) {
  const masked = maskSecret(value || '暂无数据')
  return typeof masked === 'string' ? masked : JSON.stringify(masked)
}
</script>

<style scoped>
.log-summary-text {
  margin: 0;
  color: #44524d;
  line-height: 1.7;
  word-break: break-word;
}
</style>
