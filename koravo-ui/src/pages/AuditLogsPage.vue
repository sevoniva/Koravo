<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>审计日志</h1>
        <p>按租户查询关键操作记录。</p>
      </div>
      <a-button :loading="loading" @click="search"><ReloadOutlined />查询</a-button>
    </div>

    <a-form layout="vertical" class="form-grid">
      <a-form-item label="用户"><a-input v-model:value="filters.userId" /></a-form-item>
      <a-form-item label="动作"><a-input v-model:value="filters.action" /></a-form-item>
      <a-form-item label="资源类型"><a-input v-model:value="filters.resourceType" /></a-form-item>
      <a-form-item label="资源 ID"><a-input v-model:value="filters.resourceId" /></a-form-item>
      <a-form-item label="请求 ID"><a-input v-model:value="filters.requestId" /></a-form-item>
      <a-form-item label="开始时间"><a-input v-model:value="filters.startTime" placeholder="2026-06-07T00:00:00Z" /></a-form-item>
      <a-form-item label="结束时间"><a-input v-model:value="filters.endTime" placeholder="2026-06-07T23:59:59Z" /></a-form-item>
    </a-form>

    <a-table
      :data-source="items"
      :columns="columns"
      row-key="id"
      :loading="loading"
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #emptyText>
        <a-empty description="暂无审计日志" />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'detail'">
          <code>{{ record.detailJson }}</code>
        </template>
        <template v-if="column.key === 'actionView'">
          <a-button size="small" @click="openDetail(record)">查看</a-button>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="detailOpen" title="审计详情" :footer="null" width="820px">
      <a-descriptions v-if="selectedAudit" bordered :column="2" size="small" class="panel-block">
        <a-descriptions-item label="时间">{{ selectedAudit.createdAt }}</a-descriptions-item>
        <a-descriptions-item label="用户">{{ selectedAudit.userId }}</a-descriptions-item>
        <a-descriptions-item label="动作">{{ selectedAudit.action }}</a-descriptions-item>
        <a-descriptions-item label="资源">{{ selectedAudit.resourceType }}</a-descriptions-item>
        <a-descriptions-item label="资源 ID">{{ selectedAudit.resourceId }}</a-descriptions-item>
        <a-descriptions-item label="请求 ID">{{ selectedAudit.requestId }}</a-descriptions-item>
        <a-descriptions-item label="客户端 IP">{{ selectedAudit.clientIp }}</a-descriptions-item>
        <a-descriptions-item label="租户">{{ selectedAudit.tenantId }}</a-descriptions-item>
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
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 190 },
  { title: '用户', dataIndex: 'userId', key: 'userId', width: 130 },
  { title: '动作', dataIndex: 'action', key: 'action', width: 180 },
  { title: '资源类型', dataIndex: 'resourceType', key: 'resourceType', width: 140 },
  { title: '资源 ID', dataIndex: 'resourceId', key: 'resourceId', width: 170 },
  { title: '请求 ID', dataIndex: 'requestId', key: 'requestId', width: 180 },
  { title: '客户端 IP', dataIndex: 'clientIp', key: 'clientIp', width: 140 },
  { title: '详情', key: 'detail' },
  { title: '操作', key: 'actionView', width: 90 }
]

const pagination = computed<TablePaginationConfig>(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (count) => `共 ${count} 条审计日志`
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
