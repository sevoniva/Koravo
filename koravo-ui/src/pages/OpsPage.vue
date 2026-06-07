<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>Ops</h1>
        <p>Inspect process instances for operational troubleshooting.</p>
      </div>
      <a-button :loading="loading" @click="load"><ReloadOutlined />Reload</a-button>
    </div>

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
import { getOpsInstance, getProcessTrace, listOpsInstances, type ProcessTrace } from '../api/koravo'

const loading = ref(false)
const instances = ref<unknown[]>([])
const detail = ref<unknown>(null)
const traceDetail = ref<ProcessTrace | null>(null)

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

async function load() {
  loading.value = true
  try {
    const page = await listOpsInstances()
    instances.value = page.items
  } finally {
    loading.value = false
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

onMounted(load)
</script>
