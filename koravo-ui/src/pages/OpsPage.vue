<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>运维中心</h1>
        <p>查看流程实例、流程追踪、连接器日志和异常摘要。</p>
      </div>
      <a-button :loading="loading" @click="load"><ReloadOutlined />刷新</a-button>
    </div>

    <a-tabs v-model:activeKey="activeTab" @change="load">
      <a-tab-pane key="instances" tab="流程实例">
        <a-table
          :data-source="instances"
          :columns="columns"
          row-key="instanceId"
          :loading="loading"
          :pagination="instancePagination"
          @change="handleInstanceTableChange"
        >
          <template #emptyText>
            <a-empty description="暂无流程实例" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
              <a-space wrap>
                <a-button size="small" @click="inspect(record.instanceId)">实例详情</a-button>
                <a-button size="small" type="primary" @click="trace(record.instanceId)">流程追踪</a-button>
                <a-button size="small" @click="router.push(`/process-instances/${record.instanceId}`)">打开详情页</a-button>
                <a-button
                  v-if="record.status === 'RUNNING'"
                  size="small"
                  :loading="actionLoading === `suspend:${record.instanceId}`"
                  @click="suspend(record.instanceId)"
                >
                  挂起
                </a-button>
                <a-button
                  v-if="record.status === 'SUSPENDED'"
                  size="small"
                  :loading="actionLoading === `activate:${record.instanceId}`"
                  @click="activate(record.instanceId)"
                >
                  激活
                </a-button>
                <a-popconfirm
                  v-if="record.status !== 'COMPLETED'"
                  title="确认终止该流程实例？"
                  ok-text="终止"
                  cancel-text="取消"
                  @confirm="terminate(record.instanceId)"
                >
                  <a-button size="small" danger :loading="actionLoading === `terminate:${record.instanceId}`">终止</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="connectors" tab="连接器日志">
        <div class="metric-grid panel-block">
          <a-card title="调用总数"><strong>{{ connectorSummary?.total ?? 0 }}</strong><span>当前租户连接器调用</span></a-card>
          <a-card title="成功"><strong>{{ connectorSummary?.success ?? 0 }}</strong><span>已完成调用</span></a-card>
          <a-card title="失败"><strong>{{ connectorSummary?.failed ?? 0 }}</strong><span>异常调用</span></a-card>
        </div>

        <a-form layout="vertical" class="form-grid">
          <a-form-item label="连接器类型">
            <a-input v-model:value="connectorFilters.connectorType" placeholder="http" />
          </a-form-item>
          <a-form-item label="状态">
            <a-select v-model:value="connectorFilters.status" allow-clear>
              <a-select-option value="SUCCESS">SUCCESS</a-select-option>
              <a-select-option value="FAILED">FAILED</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="请求 ID">
            <a-input v-model:value="connectorFilters.requestId" />
          </a-form-item>
          <a-form-item>
            <a-button type="primary" :loading="connectorLoading" @click="searchConnectorLogs">查询</a-button>
          </a-form-item>
        </a-form>

        <a-table
          :data-source="connectorLogs"
          :columns="connectorColumns"
          row-key="id"
          :loading="connectorLoading"
          :pagination="connectorPagination"
          size="small"
          @change="handleConnectorTableChange"
        >
          <template #emptyText>
            <a-empty description="暂无连接器日志" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'summary'">
              <code>{{ record.errorMessage || record.responseSummary || record.requestSummary }}</code>
            </template>
            <template v-if="column.key === 'action'">
              <a-button size="small" @click="openConnectorDetail(record)">查看</a-button>
            </template>
          </template>
        </a-table>

        <a-table
          v-if="connectorSummary?.recentFailures?.length"
          class="panel-block"
          :data-source="connectorSummary.recentFailures"
          :columns="connectorFailureColumns"
          row-key="id"
          :pagination="false"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'error'">
              <code>{{ record.errorMessage }}</code>
            </template>
            <template v-if="column.key === 'action'">
              <a-button size="small" @click="openConnectorDetail(record)">查看</a-button>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="failed" tab="失败任务">
        <div class="metric-grid panel-block">
          <a-card title="失败任务"><strong>{{ opsSummary?.failedJobCount ?? 0 }}</strong><span>Flowable 异常作业</span></a-card>
          <a-card title="运行中实例"><strong>{{ opsSummary?.runningInstanceCount ?? 0 }}</strong><span>当前租户</span></a-card>
        </div>
        <a-empty v-if="!(opsSummary?.failedJobCount)" description="暂无失败任务" />
        <a-alert
          v-else
          type="warning"
          show-icon
          message="存在失败任务"
          description="当前版本只显示摘要；重试和删除需接入作业详情后开放。"
        />
      </a-tab-pane>

      <a-tab-pane key="dead-letter" tab="死信任务">
        <div class="metric-grid panel-block">
          <a-card title="死信任务"><strong>{{ opsSummary?.deadLetterJobCount ?? 0 }}</strong><span>Dead letter jobs</span></a-card>
          <a-card title="连接器失败"><strong>{{ opsSummary?.connectorFailureCount ?? 0 }}</strong><span>连接器日志</span></a-card>
        </div>
        <a-empty v-if="!(opsSummary?.deadLetterJobCount)" description="暂无死信任务" />
        <a-alert
          v-else
          type="warning"
          show-icon
          message="存在死信任务"
          description="当前版本只显示摘要；删除需接入作业详情后开放。"
        />
      </a-tab-pane>

      <a-tab-pane key="exceptions" tab="异常摘要">
        <div class="metric-grid panel-block">
          <a-card title="失败任务"><strong>{{ opsSummary?.failedJobCount ?? 0 }}</strong><span>Flowable 作业异常</span></a-card>
          <a-card title="死信任务"><strong>{{ opsSummary?.deadLetterJobCount ?? 0 }}</strong><span>Dead letter jobs</span></a-card>
          <a-card title="连接器失败"><strong>{{ opsSummary?.connectorFailureCount ?? 0 }}</strong><span>当前租户</span></a-card>
        </div>
        <a-table
          class="panel-block"
          :data-source="opsSummary?.exceptions || []"
          :columns="summaryColumns"
          row-key="key"
          :pagination="false"
          size="small"
        >
          <template #emptyText>
            <a-empty description="暂无异常摘要" />
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="capabilities" tab="能力清单">
        <a-table
          :data-source="capabilities"
          :columns="capabilityColumns"
          row-key="key"
          :loading="capabilityLoading"
          :pagination="false"
          size="small"
        >
          <template #emptyText>
            <a-empty description="暂无能力清单" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="record.status === 'AVAILABLE' ? 'green' : 'orange'">{{ record.status }}</a-tag>
            </template>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>

    <div v-if="traceDetail" class="trace-viewer-panel panel-block">
      <div class="trace-viewer-heading">
        <strong>流程追踪</strong>
        <a-space>
          <span><i class="trace-dot trace-dot-completed" />已完成</span>
          <span><i class="trace-dot trace-dot-current" />当前</span>
        </a-space>
      </div>
      <div ref="traceCanvasRef" class="trace-viewer-canvas" />
    </div>

    <a-table
      v-if="traceDetail"
      class="panel-block"
      :data-source="traceDetail.timeline"
      :columns="traceColumns"
      row-key="activityId"
      :pagination="false"
      size="small"
    />

    <JsonPreview :value="detail" />

    <a-modal v-model:open="connectorDetailOpen" title="连接器执行详情" :footer="null" width="860px">
      <a-descriptions v-if="selectedConnectorLog" bordered :column="2" size="small" class="panel-block">
        <a-descriptions-item label="时间">{{ selectedConnectorLog.createdAt }}</a-descriptions-item>
        <a-descriptions-item label="类型">{{ selectedConnectorLog.connectorType }}</a-descriptions-item>
        <a-descriptions-item label="方法">{{ selectedConnectorLog.method }}</a-descriptions-item>
        <a-descriptions-item label="状态">{{ selectedConnectorLog.status }}</a-descriptions-item>
        <a-descriptions-item label="状态码">{{ selectedConnectorLog.statusCode }}</a-descriptions-item>
        <a-descriptions-item label="耗时 ms">{{ selectedConnectorLog.elapsedMillis }}</a-descriptions-item>
        <a-descriptions-item label="请求 ID">{{ selectedConnectorLog.requestId }}</a-descriptions-item>
        <a-descriptions-item label="URL">{{ selectedConnectorLog.url }}</a-descriptions-item>
      </a-descriptions>
      <a-tabs v-if="selectedConnectorLog">
        <a-tab-pane key="request" tab="请求">
          <JsonPreview :value="selectedConnectorRequest" />
        </a-tab-pane>
        <a-tab-pane key="response" tab="响应">
          <JsonPreview :value="selectedConnectorResponse" />
        </a-tab-pane>
        <a-tab-pane key="error" tab="错误">
          <JsonPreview :value="selectedConnectorError" />
        </a-tab-pane>
      </a-tabs>
    </a-modal>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { message, type TablePaginationConfig } from 'ant-design-vue'
import BpmnNavigatedViewer from 'bpmn-js/lib/NavigatedViewer'
import JsonPreview from '../components/JsonPreview.vue'
import {
  activateProcessInstance,
  getConnectorExecutionSummary,
  getOpsInstance,
  getOpsSummary,
  getProcessTrace,
  listConnectorExecutionLogs,
  listOpsCapabilities,
  listOpsInstances,
  suspendProcessInstance,
  terminateProcessInstance,
  type ConnectorExecutionLogItem,
  type ConnectorExecutionSummary,
  type OpsCapabilityItem,
  type OpsSummary,
  type OpsProcessInstance,
  type ProcessTrace
} from '../api/koravo'

const loading = ref(false)
const router = useRouter()
const route = useRoute()
const instances = ref<OpsProcessInstance[]>([])
const instancePage = ref(1)
const instancePageSize = ref(20)
const instanceTotal = ref(0)
const detail = ref<unknown>(null)
const traceDetail = ref<ProcessTrace | null>(null)
const traceCanvasRef = ref<HTMLElement | null>(null)
const actionLoading = ref<string | null>(null)
const activeTab = ref('instances')
const connectorLoading = ref(false)
const connectorLogs = ref<ConnectorExecutionLogItem[]>([])
const connectorSummary = ref<ConnectorExecutionSummary | null>(null)
const opsSummary = ref<OpsSummary | null>(null)
const connectorDetailOpen = ref(false)
const selectedConnectorLog = ref<ConnectorExecutionLogItem | null>(null)
const selectedConnectorRequest = ref<unknown>({})
const selectedConnectorResponse = ref<unknown>({})
const selectedConnectorError = ref<unknown>({})
const capabilities = ref<OpsCapabilityItem[]>([])
const capabilityLoading = ref(false)
const connectorPage = ref(1)
const connectorPageSize = ref(20)
const connectorTotal = ref(0)
const connectorFilters = ref({
  connectorType: 'http',
  status: undefined as string | undefined,
  requestId: ''
})

const columns = [
  { title: '实例 ID', dataIndex: 'instanceId', key: 'instanceId' },
  { title: '业务编号', dataIndex: 'businessKey', key: 'businessKey' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '发起时间', dataIndex: 'startTime', key: 'startTime' },
  { title: '操作', key: 'action', width: 420 }
]

const traceColumns = [
  { title: '活动 ID', dataIndex: 'activityId', key: 'activityId' },
  { title: '名称', dataIndex: 'activityName', key: 'activityName' },
  { title: '类型', dataIndex: 'activityType', key: 'activityType' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 110 },
  { title: '开始时间', dataIndex: 'startTime', key: 'startTime' },
  { title: '结束时间', dataIndex: 'endTime', key: 'endTime' }
]

const connectorColumns = [
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 190 },
  { title: '类型', dataIndex: 'connectorType', key: 'connectorType', width: 90 },
  { title: '方法', dataIndex: 'method', key: 'method', width: 90 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 110 },
  { title: '状态码', dataIndex: 'statusCode', key: 'statusCode', width: 80 },
  { title: '耗时 ms', dataIndex: 'elapsedMillis', key: 'elapsedMillis', width: 100 },
  { title: '请求 ID', dataIndex: 'requestId', key: 'requestId', width: 180 },
  { title: 'URL', dataIndex: 'url', key: 'url', width: 260 },
  { title: '摘要', key: 'summary' },
  { title: '操作', key: 'action', width: 90 }
]

const connectorFailureColumns = [
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 190 },
  { title: '类型', dataIndex: 'connectorType', key: 'connectorType', width: 90 },
  { title: 'URL', dataIndex: 'url', key: 'url', width: 260 },
  { title: '请求 ID', dataIndex: 'requestId', key: 'requestId', width: 180 },
  { title: '错误', key: 'error' },
  { title: '操作', key: 'action', width: 90 }
]

const summaryColumns = [
  { title: '类型', dataIndex: 'name', key: 'name', width: 180 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 110 },
  { title: '数量', dataIndex: 'count', key: 'count', width: 100 },
  { title: '说明', dataIndex: 'message', key: 'message' }
]

const capabilityColumns = [
  { title: '能力', dataIndex: 'name', key: 'name', width: 240 },
  { title: '状态', key: 'status', width: 130 },
  { title: 'Key', dataIndex: 'key', key: 'key', width: 230 },
  { title: '说明', dataIndex: 'description', key: 'description' }
]

const connectorPagination = computed<TablePaginationConfig>(() => ({
  current: connectorPage.value,
  pageSize: connectorPageSize.value,
  total: connectorTotal.value,
  showSizeChanger: true,
  showTotal: (count) => `共 ${count} 条连接器日志`
}))

const instancePagination = computed<TablePaginationConfig>(() => ({
  current: instancePage.value,
  pageSize: instancePageSize.value,
  total: instanceTotal.value,
  showSizeChanger: true,
  showTotal: (count) => `共 ${count} 个流程实例`
}))

let traceViewer: any = null

async function load() {
  loading.value = true
  try {
    if (activeTab.value === 'connectors') {
      await loadConnectorLogs()
    } else if (activeTab.value === 'capabilities') {
      await loadCapabilities()
    } else if (['exceptions', 'failed', 'dead-letter'].includes(activeTab.value)) {
      await loadOpsSummary()
    } else {
      const page = await listOpsInstances({
        page: instancePage.value,
        pageSize: instancePageSize.value
      })
      instances.value = page.items
      instanceTotal.value = page.total
      instancePage.value = page.page
      instancePageSize.value = page.pageSize
    }
  } finally {
    loading.value = false
  }
}

async function loadCapabilities() {
  capabilityLoading.value = true
  try {
    capabilities.value = await listOpsCapabilities()
  } finally {
    capabilityLoading.value = false
  }
}

async function loadOpsSummary() {
  opsSummary.value = await getOpsSummary()
}

function handleInstanceTableChange(nextPagination: TablePaginationConfig) {
  instancePage.value = nextPagination.current || 1
  instancePageSize.value = nextPagination.pageSize || 20
  load()
}

async function loadConnectorLogs() {
  connectorLoading.value = true
  try {
    connectorSummary.value = await getConnectorExecutionSummary(connectorFilters.value.connectorType || undefined)
    const page = await listConnectorExecutionLogs({
      connectorType: connectorFilters.value.connectorType || undefined,
      status: connectorFilters.value.status,
      requestId: connectorFilters.value.requestId || undefined,
      page: connectorPage.value,
      pageSize: connectorPageSize.value
    })
    connectorLogs.value = page.items
    connectorTotal.value = page.total
    connectorPage.value = page.page
    connectorPageSize.value = page.pageSize
  } finally {
    connectorLoading.value = false
  }
}

async function searchConnectorLogs() {
  connectorPage.value = 1
  await loadConnectorLogs()
}

function handleConnectorTableChange(nextPagination: TablePaginationConfig) {
  connectorPage.value = nextPagination.current || 1
  connectorPageSize.value = nextPagination.pageSize || 20
  loadConnectorLogs()
}

async function inspect(instanceId: string) {
  detail.value = await getOpsInstance(instanceId)
  traceDetail.value = null
  destroyTraceViewer()
}

async function trace(instanceId: string) {
  activeTab.value = 'instances'
  traceDetail.value = await getProcessTrace(instanceId)
  detail.value = traceDetail.value
  await renderTraceDiagram()
}

async function terminate(instanceId: string) {
  await runInstanceAction(`terminate:${instanceId}`, instanceId, async () => {
    await terminateProcessInstance(instanceId, '从运维中心终止')
    message.success('流程已终止')
  })
}

async function suspend(instanceId: string) {
  await runInstanceAction(`suspend:${instanceId}`, instanceId, async () => {
    await suspendProcessInstance(instanceId)
    message.success('流程已挂起')
  })
}

async function activate(instanceId: string) {
  await runInstanceAction(`activate:${instanceId}`, instanceId, async () => {
    await activateProcessInstance(instanceId)
    message.success('流程已激活')
  })
}

async function runInstanceAction(actionKey: string, instanceId: string, action: () => Promise<void>) {
  actionLoading.value = actionKey
  try {
    await action()
    await load()
    if (traceDetail.value?.instanceId === instanceId) {
      await trace(instanceId)
    }
  } finally {
    actionLoading.value = null
  }
}

async function renderTraceDiagram() {
  if (!traceDetail.value?.bpmnXml) {
    return
  }

  await nextTick()
  if (!traceCanvasRef.value) {
    return
  }

  destroyTraceViewer()
  traceViewer = new BpmnNavigatedViewer({
    container: traceCanvasRef.value
  })

  await traceViewer.importXML(traceDetail.value.bpmnXml)

  const canvas = traceViewer.get('canvas')
  const completedActivityIds = traceDetail.value.timeline
    .filter((item) => item.status === 'COMPLETED')
    .map((item) => item.activityId)

  for (const activityId of completedActivityIds) {
    canvas.addMarker(activityId, 'trace-completed')
  }
  for (const activityId of traceDetail.value.currentActivityIds) {
    canvas.addMarker(activityId, 'trace-current')
  }
  canvas.zoom('fit-viewport')
}

function destroyTraceViewer() {
  if (traceViewer) {
    traceViewer.destroy()
    traceViewer = null
  }
}

function openConnectorDetail(record: ConnectorExecutionLogItem) {
  selectedConnectorLog.value = record
  selectedConnectorRequest.value = parseJsonValue(record.requestSummary)
  selectedConnectorResponse.value = parseJsonValue(record.responseSummary)
  selectedConnectorError.value = record.errorMessage ? { message: record.errorMessage } : {}
  connectorDetailOpen.value = true
}

function parseJsonValue(value?: string) {
  if (!value) return {}
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

onMounted(async () => {
  const routeTab = typeof route.query.tab === 'string' ? route.query.tab : ''
  if (routeTab === 'connectors') {
    activeTab.value = 'connectors'
  } else if (['failed', 'dead-letter', 'exceptions'].includes(routeTab)) {
    activeTab.value = routeTab
  }
  await load()
  await loadConnectorLogs()
  await loadOpsSummary()
  await loadCapabilities()
  await loadRouteTrace()
})

onBeforeUnmount(() => {
  destroyTraceViewer()
})

async function loadRouteTrace() {
  const instanceId = typeof route.query.instanceId === 'string' ? route.query.instanceId : undefined
  if (route.query.view === 'trace' && instanceId) {
    await trace(instanceId)
  }
}
</script>
