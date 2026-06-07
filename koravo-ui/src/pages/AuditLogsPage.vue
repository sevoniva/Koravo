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
    </a-form>

    <a-table :data-source="items" :columns="columns" row-key="id" :pagination="false">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'detail'">
          <code>{{ record.detailJson }}</code>
        </template>
      </template>
    </a-table>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { listAuditLogs, type AuditLogItem } from '../api/koravo'

const loading = ref(false)
const items = ref<AuditLogItem[]>([])
const filters = reactive({
  userId: '',
  action: '',
  resourceType: ''
})

const columns = [
  { title: 'Time', dataIndex: 'createdAt', key: 'createdAt', width: 190 },
  { title: 'User', dataIndex: 'userId', key: 'userId', width: 130 },
  { title: 'Action', dataIndex: 'action', key: 'action', width: 180 },
  { title: 'Resource', dataIndex: 'resourceType', key: 'resourceType', width: 140 },
  { title: 'Resource ID', dataIndex: 'resourceId', key: 'resourceId', width: 170 },
  { title: 'Detail', key: 'detail' }
]

async function load() {
  loading.value = true
  try {
    const page = await listAuditLogs({
      userId: filters.userId || undefined,
      action: filters.action || undefined,
      resourceType: filters.resourceType || undefined,
      page: 1,
      pageSize: 30
    })
    items.value = page.items
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
