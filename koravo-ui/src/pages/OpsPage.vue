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
        <a-table :data-source="instances" :columns="columns" row-key="instanceId" :pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
              <a-space>
                <a-button size="small" @click="inspect(record.instanceId)">Inspect</a-button>
                <a-button size="small" type="primary" @click="trace(record.instanceId)">Trace</a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="connectors" tab="Connector Logs">
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
            <a-button type="primary" :loading="connectorLoading" @click="loadConnectorLogs">Search</a-button>
          </a-form-item>
        </a-form>

        <a-table :data-source="connectorLogs" :columns="connectorColumns" row-key="id" :pagination="false" size="small">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'summary'">
              <code>{{ record.errorMessage || record.responseSummary || record.requestSummary }}</code>
            </template>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>

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
import { onMounted, ref } from 'vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import JsonPreview from '../components/JsonPreview.vue'
import {
  getOpsInstance,
  getProcessTrace,
  listConnectorExecutionLogs,
  listOpsInstances,
  type ConnectorExecutionLogItem,
  type ProcessTrace
} from '../api/koravo'

const loading = ref(false)
const instances = ref<unknown[]>([])
const detail = ref<unknown>(null)
const traceDetail = ref<ProcessTrace | null>(null)
const activeTab = ref('instances')
const connectorLoading = ref(false)
const connectorLogs = ref<ConnectorExecutionLogItem[]>([])
const connectorFilters = ref({
  connectorType: 'http',
  status: undefined as string | undefined
})

const columns = [
  { title: 'Instance ID', dataIndex: 'instanceId', key: 'instanceId' },
  { title: 'Business Key', dataIndex: 'businessKey', key: 'businessKey' },
  { title: 'Status', dataIndex: 'status', key: 'status' },
  { title: 'Started', dataIndex: 'startTime', key: 'startTime' },
  { title: 'Action', key: 'action', width: 100 }
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

async function load() {
  loading.value = true
  try {
    if (activeTab.value === 'connectors') {
      await loadConnectorLogs()
    } else {
      const page = await listOpsInstances()
      instances.value = page.items
    }
  } finally {
    loading.value = false
  }
}

async function loadConnectorLogs() {
  connectorLoading.value = true
  try {
    const page = await listConnectorExecutionLogs({
      connectorType: connectorFilters.value.connectorType || undefined,
      status: connectorFilters.value.status,
      page: 1,
      pageSize: 30
    })
    connectorLogs.value = page.items
  } finally {
    connectorLoading.value = false
  }
}

async function inspect(instanceId: string) {
  detail.value = await getOpsInstance(instanceId)
  traceDetail.value = null
}

async function trace(instanceId: string) {
  traceDetail.value = await getProcessTrace(instanceId)
  detail.value = traceDetail.value
}

onMounted(async () => {
  await load()
  await loadConnectorLogs()
})
</script>
