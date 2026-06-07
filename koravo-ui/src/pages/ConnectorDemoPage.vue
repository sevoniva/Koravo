<template>
  <PageContainer>
    <PageHeader title="连接器示例" description="部署并启动 HTTP Connector 示例流程。">
      <template #actions>
        <a-button :loading="initLoading" @click="initConnectorDemo"><ThunderboltOutlined />初始化示例</a-button>
        <a-button type="primary" :loading="startLoading" @click="startDemo"><PlayCircleOutlined />启动流程</a-button>
        <a-button @click="router.push('/ops?tab=connectors')"><ApiOutlined />连接器日志</a-button>
      </template>
    </PageHeader>

    <a-alert
      :type="error ? 'error' : processModel ? 'success' : 'info'"
      show-icon
      :message="error || statusMessage"
      description="流程会调用本机 /api/v1/health，并把响应写入流程变量。"
    />

    <div class="connector-result-grid panel-block">
      <MetricCard label="流程模型" :value="processModel?.status || '未初始化'" :status="processModel?.status" :description="processModel?.modelKey || 'httpConnectorDemo'" />
      <MetricCard label="调用目标" value="GET /api/v1/health" description="localhost:8080" />
      <MetricCard label="最近请求" :value="requestId || '-'" description="X-Request-Id" />
    </div>

    <div class="two-column-grid">
      <DetailSection title="流程结果">
        <a-descriptions :column="1" bordered size="small">
          <a-descriptions-item label="实例"><CopyableText :value="instanceId" /></a-descriptions-item>
          <a-descriptions-item label="状态"><StatusTag :status="trace?.status" /></a-descriptions-item>
          <a-descriptions-item label="当前任务">{{ currentTaskText }}</a-descriptions-item>
          <a-descriptions-item label="返回变量">{{ resultVariableName }}</a-descriptions-item>
        </a-descriptions>
        <a-space class="panel-block" wrap>
          <a-button :disabled="!instanceId" @click="router.push(`/process-instances/${instanceId}`)">流程追踪</a-button>
          <a-button :disabled="!currentTaskId" @click="router.push(`/tasks/${currentTaskId}`)">后续任务</a-button>
          <a-button :loading="logLoading" @click="loadLogs">刷新日志</a-button>
        </a-space>
        <JsonPreview :value="resultVariable" />
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
            <template v-else-if="column.key === 'action'">
              <a-button size="small" @click="openLog(record)">查看</a-button>
            </template>
          </template>
        </a-table>
      </DetailSection>
    </div>

    <a-modal v-model:open="logOpen" title="连接器日志" width="760px" :footer="null">
      <a-descriptions v-if="selectedLog" :column="1" bordered size="small">
        <a-descriptions-item label="状态"><StatusTag :status="selectedLog.status" /></a-descriptions-item>
        <a-descriptions-item label="HTTP">{{ selectedLog.method }} {{ selectedLog.statusCode || '-' }}</a-descriptions-item>
        <a-descriptions-item label="耗时">{{ formatDuration(selectedLog.elapsedMillis) }}</a-descriptions-item>
        <a-descriptions-item label="请求 ID"><CopyableText :value="selectedLog.requestId" /></a-descriptions-item>
        <a-descriptions-item label="URL">{{ selectedLog.url }}</a-descriptions-item>
      </a-descriptions>
      <JsonPreview :value="selectedLog" />
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
import { CopyableText, DetailSection, EmptyState, MetricCard, PageContainer, PageHeader, StatusTag } from '../components/ui'
import { useSessionStore } from '../stores/session'
import { formatDuration } from '../utils/format'

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
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt' },
  { title: '操作', key: 'action', width: 80 }
]

const statusMessage = computed(() => {
  if (!processModel.value) return '示例流程未初始化'
  return processModel.value.status === 'DEPLOYED' ? '示例流程已部署' : '示例流程待部署'
})

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

async function initConnectorDemo() {
  initLoading.value = true
  error.value = ''
  try {
    processModel.value = await ensureModel()
    message.success('连接器示例已就绪')
  } catch (nextError: any) {
    error.value = nextError?.message || '初始化失败'
  } finally {
    initLoading.value = false
  }
}

async function startDemo() {
  startLoading.value = true
  error.value = ''
  try {
    processModel.value = await ensureModel()
    requestId.value = `demo-http-${Date.now()}`
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
    message.success('HTTP Connector 流程已启动')
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
    modelName: 'HTTP Connector 示例',
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
  <process id="httpConnectorDemo" name="HTTP Connector 示例" isExecutable="true">
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
</script>
