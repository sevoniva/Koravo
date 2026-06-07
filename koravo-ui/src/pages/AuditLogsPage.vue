<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>Audit Logs</h1>
        <p>Search tenant-scoped operational audit events.</p>
      </div>
      <a-button :loading="loading" @click="search"><ReloadOutlined />Search</a-button>
    </div>

    <a-form layout="vertical" class="form-grid">
      <a-form-item label="User"><a-input v-model:value="filters.userId" /></a-form-item>
      <a-form-item label="Action"><a-input v-model:value="filters.action" /></a-form-item>
      <a-form-item label="Resource type"><a-input v-model:value="filters.resourceType" /></a-form-item>
      <a-form-item label="Resource ID"><a-input v-model:value="filters.resourceId" /></a-form-item>
      <a-form-item label="Request ID"><a-input v-model:value="filters.requestId" /></a-form-item>
      <a-form-item label="Start time"><a-input v-model:value="filters.startTime" placeholder="2026-06-07T00:00:00Z" /></a-form-item>
      <a-form-item label="End time"><a-input v-model:value="filters.endTime" placeholder="2026-06-07T23:59:59Z" /></a-form-item>
    </a-form>

    <a-table
      :data-source="items"
      :columns="columns"
      row-key="id"
      :loading="loading"
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'detail'">
          <code>{{ record.detailJson }}</code>
        </template>
        <template v-if="column.key === 'actionView'">
          <a-button size="small" @click="openDetail(record)">View</a-button>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="detailOpen" title="Audit detail" :footer="null" width="820px">
      <a-descriptions v-if="selectedAudit" bordered :column="2" size="small" class="panel-block">
        <a-descriptions-item label="Time">{{ selectedAudit.createdAt }}</a-descriptions-item>
        <a-descriptions-item label="User">{{ selectedAudit.userId }}</a-descriptions-item>
        <a-descriptions-item label="Action">{{ selectedAudit.action }}</a-descriptions-item>
        <a-descriptions-item label="Resource">{{ selectedAudit.resourceType }}</a-descriptions-item>
        <a-descriptions-item label="Resource ID">{{ selectedAudit.resourceId }}</a-descriptions-item>
        <a-descriptions-item label="Request ID">{{ selectedAudit.requestId }}</a-descriptions-item>
        <a-descriptions-item label="Client IP">{{ selectedAudit.clientIp }}</a-descriptions-item>
        <a-descriptions-item label="Tenant">{{ selectedAudit.tenantId }}</a-descriptions-item>
      </a-descriptions>
      <JsonPreview :value="selectedAuditDetail" />
    </a-modal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { TablePaginationConfig } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { listAuditLogs, type AuditLogItem } from '../api/koravo'
import JsonPreview from '../components/JsonPreview.vue'

const loading = ref(false)
const items = ref<AuditLogItem[]>([])
const detailOpen = ref(false)
const selectedAudit = ref<AuditLogItem | null>(null)
const selectedAuditDetail = ref<unknown>({})
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const filters = reactive({
  userId: '',
  action: '',
  resourceType: '',
  resourceId: '',
  requestId: '',
  startTime: '',
  endTime: ''
})

const columns = [
  { title: 'Time', dataIndex: 'createdAt', key: 'createdAt', width: 190 },
  { title: 'User', dataIndex: 'userId', key: 'userId', width: 130 },
  { title: 'Action', dataIndex: 'action', key: 'action', width: 180 },
  { title: 'Resource', dataIndex: 'resourceType', key: 'resourceType', width: 140 },
  { title: 'Resource ID', dataIndex: 'resourceId', key: 'resourceId', width: 170 },
  { title: 'Request ID', dataIndex: 'requestId', key: 'requestId', width: 180 },
  { title: 'Client IP', dataIndex: 'clientIp', key: 'clientIp', width: 140 },
  { title: 'Detail', key: 'detail' },
  { title: 'Action', key: 'actionView', width: 90 }
]

const pagination = computed<TablePaginationConfig>(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (count) => `${count} audit logs`
}))

async function load() {
  loading.value = true
  try {
    const result = await listAuditLogs({
      userId: filters.userId || undefined,
      action: filters.action || undefined,
      resourceType: filters.resourceType || undefined,
      resourceId: filters.resourceId || undefined,
      requestId: filters.requestId || undefined,
      startTime: filters.startTime || undefined,
      endTime: filters.endTime || undefined,
      page: page.value,
      pageSize: pageSize.value
    })
    items.value = result.items
    total.value = result.total
    page.value = result.page
    pageSize.value = result.pageSize
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  load()
}

function handleTableChange(nextPagination: TablePaginationConfig) {
  page.value = nextPagination.current || 1
  pageSize.value = nextPagination.pageSize || 20
  load()
}

function openDetail(record: AuditLogItem) {
  selectedAudit.value = record
  selectedAuditDetail.value = parseJsonValue(record.detailJson)
  detailOpen.value = true
}

function parseJsonValue(value?: string) {
  if (!value) return {}
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

onMounted(load)
</script>
