<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>Process Instances</h1>
        <p>Start process instances and inspect their current state.</p>
      </div>
      <a-button :loading="listLoading" @click="loadStartedInstances"><ReloadOutlined />Reload</a-button>
    </div>

    <a-form layout="vertical" class="form-grid">
      <a-form-item label="Process definition key"><a-input v-model:value="processDefinitionKey" /></a-form-item>
      <a-form-item label="Business key"><a-input v-model:value="businessKey" /></a-form-item>
      <a-form-item label="Variables JSON" class="span-2">
        <a-textarea v-model:value="variablesText" :rows="8" />
      </a-form-item>
      <a-form-item>
        <a-button type="primary" :loading="loading" @click="start"><PlayCircleOutlined />Start</a-button>
      </a-form-item>
    </a-form>

    <JsonPreview :value="instance" />
    <a-button v-if="instance" class="panel-block" @click="router.push(`/process-instances/${instance.instanceId}`)">Detail</a-button>

    <a-table
      class="panel-block"
      :data-source="startedInstances"
      :columns="startedColumns"
      row-key="instanceId"
      :loading="listLoading"
      :pagination="startedPagination"
      @change="handleStartedTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button size="small" @click="router.push(`/process-instances/${record.instanceId}`)">Detail</a-button>
            <a-button size="small" @click="router.push('/ops')">Ops</a-button>
          </a-space>
        </template>
      </template>
    </a-table>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message, type TablePaginationConfig } from 'ant-design-vue'
import { PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import JsonPreview from '../components/JsonPreview.vue'
import { listStartedInstances, startProcessInstance, type OpsProcessInstance, type ProcessInstance } from '../api/koravo'
import { JsonInputError, parseJsonObject } from '../utils/jsonInput'

const processDefinitionKey = ref('leaveApproval')
const businessKey = ref('LEAVE-001')
const variablesText = ref(JSON.stringify({ applicant: 'u001', approver: 'admin', days: 2 }, null, 2))
const instance = ref<ProcessInstance | null>(null)
const loading = ref(false)
const listLoading = ref(false)
const startedInstances = ref<OpsProcessInstance[]>([])
const startedPage = ref(1)
const startedPageSize = ref(20)
const startedTotal = ref(0)
const router = useRouter()

const startedColumns = [
  { title: 'Instance ID', dataIndex: 'instanceId', key: 'instanceId' },
  { title: 'Business Key', dataIndex: 'businessKey', key: 'businessKey' },
  { title: 'Status', dataIndex: 'status', key: 'status', width: 120 },
  { title: 'Started', dataIndex: 'startTime', key: 'startTime' },
  { title: 'Ended', dataIndex: 'endTime', key: 'endTime' },
  { title: 'Action', key: 'action', width: 150 }
]

const startedPagination = computed<TablePaginationConfig>(() => ({
  current: startedPage.value,
  pageSize: startedPageSize.value,
  total: startedTotal.value,
  showSizeChanger: true,
  showTotal: (count) => `${count} started instances`
}))

async function start() {
  loading.value = true
  try {
    const variables = parseJsonObject(variablesText.value, 'Variables')
    instance.value = await startProcessInstance({ processDefinitionKey: processDefinitionKey.value, businessKey: businessKey.value, variables })
    message.success('Process started')
    startedPage.value = 1
    await loadStartedInstances()
  } catch (error) {
    if (error instanceof JsonInputError) {
      message.error(error.message)
    }
  } finally {
    loading.value = false
  }
}

async function loadStartedInstances() {
  listLoading.value = true
  try {
    const page = await listStartedInstances({
      page: startedPage.value,
      pageSize: startedPageSize.value
    })
    startedInstances.value = page.items
    startedTotal.value = page.total
    startedPage.value = page.page
    startedPageSize.value = page.pageSize
  } finally {
    listLoading.value = false
  }
}

function handleStartedTableChange(nextPagination: TablePaginationConfig) {
  startedPage.value = nextPagination.current || 1
  startedPageSize.value = nextPagination.pageSize || 20
  loadStartedInstances()
}

onMounted(loadStartedInstances)
</script>
