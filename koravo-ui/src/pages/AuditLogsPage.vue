<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>Audit Logs</h1>
        <p>Search tenant-scoped operational audit events.</p>
      </div>
      <a-button :loading="loading" @click="load"><ReloadOutlined />Search</a-button>
    </div>

    <a-form layout="vertical" class="form-grid">
      <a-form-item label="User"><a-input v-model:value="filters.userId" /></a-form-item>
      <a-form-item label="Action"><a-input v-model:value="filters.action" /></a-form-item>
      <a-form-item label="Resource type"><a-input v-model:value="filters.resourceType" /></a-form-item>
      <a-form-item label="Resource ID"><a-input v-model:value="filters.resourceId" /></a-form-item>
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
      </template>
    </a-table>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { TablePaginationConfig } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { listAuditLogs, type AuditLogItem } from '../api/koravo'

const loading = ref(false)
const items = ref<AuditLogItem[]>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const filters = reactive({
  userId: '',
  action: '',
  resourceType: '',
  resourceId: '',
  startTime: '',
  endTime: ''
})

const columns = [
  { title: 'Time', dataIndex: 'createdAt', key: 'createdAt', width: 190 },
  { title: 'User', dataIndex: 'userId', key: 'userId', width: 130 },
  { title: 'Action', dataIndex: 'action', key: 'action', width: 180 },
  { title: 'Resource', dataIndex: 'resourceType', key: 'resourceType', width: 140 },
  { title: 'Resource ID', dataIndex: 'resourceId', key: 'resourceId', width: 170 },
  { title: 'Detail', key: 'detail' }
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

function handleTableChange(nextPagination: TablePaginationConfig) {
  page.value = nextPagination.current || 1
  pageSize.value = nextPagination.pageSize || 20
  load()
}

onMounted(load)
</script>
