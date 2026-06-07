<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>Ops</h1>
        <p>Inspect process instances and connector executions for operational troubleshooting.</p>
      </div>
      <a-button :loading="loading" @click="load"><ReloadOutlined />Reload</a-button>
    </div>

    <a-tabs v-model:activeKey="activeTab">
      <a-tab-pane key="instances" tab="Process Instances">
        <a-table
          :data-source="instances"
          :columns="columns"
          row-key="instanceId"
          :loading="loading"
          :pagination="instancePagination"
          @change="handleInstanceTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
              <a-space>
                <a-button size="small" @click="inspect(record.instanceId)">Inspect</a-button>
                <a-button size="small" type="primary" @click="trace(record.instanceId)">Trace</a-button>
                <a-button size="small" @click="router.push(`/process-instances/${record.instanceId}`)">Detail</a-button>
                <a-button
                  v-if="record.status === 'RUNNING'"
                  size="small"
                  :loading="actionLoading === `suspend:${record.instanceId}`"
                  @click="suspend(record.instanceId)"
                >
                  Suspend
                </a-button>
                <a-button
                  v-if="record.status === 'SUSPENDED'"
                  size="small"
                  :loading="actionLoading === `activate:${record.instanceId}`"
                  @click="activate(record.instanceId)"
                >
                  Activate
                </a-button>
                <a-popconfirm
                  v-if="record.status !== 'COMPLETED'"
                  title="Terminate this process instance?"
                  ok-text="Terminate"
                  cancel-text="Cancel"
                  @confirm="terminate(record.instanceId)"
                >
                  <a-button size="small" danger :loading="actionLoading === `terminate:${record.instanceId}`">Terminate</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="connectors" tab="Connector Logs">
        <div class="metric-grid panel-block">
          <a-card title="Connector Total"><strong>{{ connectorSummary?.total ?? 0 }}</strong><span>Executions in current tenant</span></a-card>
          <a-card title="Success"><strong>{{ connectorSummary?.success ?? 0 }}</strong><span>Completed connector calls</span></a-card>
          <a-card title="Failed"><strong>{{ connectorSummary?.failed ?? 0 }}</strong><span>Operational exceptions</span></a-card>
        </div>

        <a-form layout="vertical" class="form-grid">
          <a-form-item label="Connector type">
            <a-input v-model:value="connectorFilters.connectorType" placeholder="http" />
          </a-form-item>
          <a-form-item label="Status">
            <a-select v-model:value="connectorFilters.status" allow-clear>
              <a-select-option value="SUCCESS">SUCCESS</a-select-option>
              <a-select-option value="FAILED">FAILED</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item>
            <a-button type="primary" :loading="connectorLoading" @click="searchConnectorLogs">Search</a-button>
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
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'summary'">
              <code>{{ record.errorMessage || record.responseSummary || record.requestSummary }}</code>
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
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="capabilities" tab="Capabilities">
        <a-table
          :data-source="capabilities"
          :columns="capabilityColumns"
          row-key="key"
          :loading="capabilityLoading"
          :pagination="false"
          size="small"
        >
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
        <strong>Process Trace</strong>
        <a-space>
          <span><i class="trace-dot trace-dot-completed" />Completed</span>
          <span><i class="trace-dot trace-dot-current" />Current</span>
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
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { message, type TablePaginationConfig } from 'ant-design-vue'
import BpmnNavigatedViewer from 'bpmn-js/lib/NavigatedViewer'
import JsonPreview from '../components/JsonPreview.vue'
import {
  activateProcessInstance,
  getConnectorExecutionSummary,
  getOpsInstance,
  getProcessTrace,
  listConnectorExecutionLogs,
  listOpsCapabilities,
  listOpsInstances,
  suspendProcessInstance,
  terminateProcessInstance,
  type ConnectorExecutionLogItem,
  type ConnectorExecutionSummary,
  type OpsCapabilityItem,
  type OpsProcessInstance,
  type ProcessTrace
} from '../api/koravo'

const loading = ref(false)
const router = useRouter()
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
const capabilities = ref<OpsCapabilityItem[]>([])
const capabilityLoading = ref(false)
const connectorPage = ref(1)
const connectorPageSize = ref(20)
const connectorTotal = ref(0)
const connectorFilters = ref({
  connectorType: 'http',
  status: undefined as string | undefined
})

const columns = [
  { title: 'Instance ID', dataIndex: 'instanceId', key: 'instanceId' },
  { title: 'Business Key', dataIndex: 'businessKey', key: 'businessKey' },
  { title: 'Status', dataIndex: 'status', key: 'status' },
  { title: 'Started', dataIndex: 'startTime', key: 'startTime' },
  { title: 'Action', key: 'action', width: 380 }
]

const traceColumns = [
  { title: 'Activity ID', dataIndex: 'activityId', key: 'activityId' },
  { title: 'Name', dataIndex: 'activityName', key: 'activityName' },
  { title: 'Type', dataIndex: 'activityType', key: 'activityType' },
  { title: 'Status', dataIndex: 'status', key: 'status', width: 110 },
  { title: 'Start', dataIndex: 'startTime', key: 'startTime' },
  { title: 'End', dataIndex: 'endTime', key: 'endTime' }
]

const connectorColumns = [
  { title: 'Time', dataIndex: 'createdAt', key: 'createdAt', width: 190 },
  { title: 'Type', dataIndex: 'connectorType', key: 'connectorType', width: 90 },
  { title: 'Method', dataIndex: 'method', key: 'method', width: 90 },
  { title: 'Status', dataIndex: 'status', key: 'status', width: 110 },
  { title: 'Code', dataIndex: 'statusCode', key: 'statusCode', width: 80 },
  { title: 'Elapsed', dataIndex: 'elapsedMillis', key: 'elapsedMillis', width: 100 },
  { title: 'URL', dataIndex: 'url', key: 'url', width: 260 },
  { title: 'Summary', key: 'summary' }
]

const connectorFailureColumns = [
  { title: 'Time', dataIndex: 'createdAt', key: 'createdAt', width: 190 },
  { title: 'Type', dataIndex: 'connectorType', key: 'connectorType', width: 90 },
  { title: 'URL', dataIndex: 'url', key: 'url', width: 260 },
  { title: 'Request ID', dataIndex: 'requestId', key: 'requestId', width: 180 },
  { title: 'Error', key: 'error' }
]

const capabilityColumns = [
  { title: 'Capability', dataIndex: 'name', key: 'name', width: 240 },
  { title: 'Status', key: 'status', width: 130 },
  { title: 'Key', dataIndex: 'key', key: 'key', width: 230 },
  { title: 'Description', dataIndex: 'description', key: 'description' }
]

const connectorPagination = computed<TablePaginationConfig>(() => ({
  current: connectorPage.value,
  pageSize: connectorPageSize.value,
  total: connectorTotal.value,
  showSizeChanger: true,
  showTotal: (count) => `${count} connector executions`
}))

const instancePagination = computed<TablePaginationConfig>(() => ({
  current: instancePage.value,
  pageSize: instancePageSize.value,
  total: instanceTotal.value,
  showSizeChanger: true,
  showTotal: (count) => `${count} process instances`
}))

let traceViewer: any = null

async function load() {
  loading.value = true
  try {
    if (activeTab.value === 'connectors') {
      await loadConnectorLogs()
    } else if (activeTab.value === 'capabilities') {
      await loadCapabilities()
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
  traceDetail.value = await getProcessTrace(instanceId)
  detail.value = traceDetail.value
  await renderTraceDiagram()
}

async function terminate(instanceId: string) {
  await runInstanceAction(`terminate:${instanceId}`, instanceId, async () => {
    await terminateProcessInstance(instanceId, 'Terminated from Ops')
    message.success('Process terminated')
  })
}

async function suspend(instanceId: string) {
  await runInstanceAction(`suspend:${instanceId}`, instanceId, async () => {
    await suspendProcessInstance(instanceId)
    message.success('Process suspended')
  })
}

async function activate(instanceId: string) {
  await runInstanceAction(`activate:${instanceId}`, instanceId, async () => {
    await activateProcessInstance(instanceId)
    message.success('Process activated')
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

onMounted(async () => {
  await load()
  await loadConnectorLogs()
  await loadCapabilities()
})

onBeforeUnmount(() => {
  destroyTraceViewer()
})
</script>
