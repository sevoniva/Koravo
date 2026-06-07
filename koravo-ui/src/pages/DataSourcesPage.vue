<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>Data Sources</h1>
        <p>Create JDBC datasource definitions and test connectivity.</p>
      </div>
      <a-button @click="load"><ReloadOutlined />Reload</a-button>
    </div>

    <a-form layout="vertical" class="form-grid">
      <a-form-item label="Name"><a-input v-model:value="form.name" /></a-form-item>
      <a-form-item label="Type">
        <a-select v-model:value="form.type">
          <a-select-option value="POSTGRESQL">PostgreSQL</a-select-option>
          <a-select-option value="MYSQL">MySQL</a-select-option>
          <a-select-option value="H2">H2</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="JDBC URL" class="span-2"><a-input v-model:value="form.jdbcUrl" /></a-form-item>
      <a-form-item label="Username"><a-input v-model:value="form.username" /></a-form-item>
      <a-form-item label="Password"><a-input-password v-model:value="form.password" /></a-form-item>
      <a-form-item label="Read only"><a-switch v-model:checked="form.readOnly" /></a-form-item>
      <a-form-item>
        <a-space>
          <a-button type="primary" :loading="saving" @click="save">
            <DatabaseOutlined />{{ editingId ? 'Update' : 'Create' }}
          </a-button>
          <a-button v-if="editingId" @click="reset">Cancel</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-table :data-source="items" :columns="columns" row-key="id" :pagination="false">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button size="small" @click="openDetail(record.id)">Detail</a-button>
            <a-button size="small" @click="edit(record)">Edit</a-button>
            <a-button size="small" @click="test(record.id)">Test</a-button>
            <a-button size="small" @click="openLogs(record.id)">Logs</a-button>
            <a-popconfirm title="Delete this datasource?" @confirm="remove(record.id)">
              <a-button size="small" danger>Delete</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="logsOpen" title="Datasource test logs" :footer="null" width="760px">
      <a-table :data-source="logs" :columns="logColumns" row-key="id" :pagination="false" size="small" />
    </a-modal>

    <a-modal v-model:open="detailOpen" title="Datasource detail" :footer="null" width="760px">
      <a-descriptions v-if="detail" bordered :column="2">
        <a-descriptions-item label="Name">{{ detail.name }}</a-descriptions-item>
        <a-descriptions-item label="Type">{{ detail.type }}</a-descriptions-item>
        <a-descriptions-item label="JDBC URL">{{ detail.jdbcUrl }}</a-descriptions-item>
        <a-descriptions-item label="Username">{{ detail.username }}</a-descriptions-item>
        <a-descriptions-item label="Driver">{{ detail.driverClassName }}</a-descriptions-item>
        <a-descriptions-item label="Read only">{{ detail.readOnly }}</a-descriptions-item>
        <a-descriptions-item label="Status">{{ detail.status }}</a-descriptions-item>
        <a-descriptions-item label="Pool config">{{ detail.poolConfigJson }}</a-descriptions-item>
      </a-descriptions>
      <JsonPreview :value="detail" />
    </a-modal>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { DatabaseOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import JsonPreview from '../components/JsonPreview.vue'
import {
  createDataSource,
  deleteDataSource,
  getDataSource,
  listDataSources,
  listDataSourceTestLogs,
  testDataSource,
  updateDataSource,
  type DataSourceItem,
  type DataSourceTestLogItem
} from '../api/koravo'

const saving = ref(false)
const editingId = ref<string | null>(null)
const items = ref<DataSourceItem[]>([])
const logsOpen = ref(false)
const detailOpen = ref(false)
const logs = ref<DataSourceTestLogItem[]>([])
const detail = ref<DataSourceItem | null>(null)
const form = reactive({
  name: 'Local PostgreSQL',
  type: 'POSTGRESQL',
  jdbcUrl: 'jdbc:postgresql://localhost:5432/koravo',
  username: 'koravo',
  password: 'koravo',
  readOnly: true,
  poolConfigJson: '{}'
})

const columns = [
  { title: 'Name', dataIndex: 'name', key: 'name' },
  { title: 'Type', dataIndex: 'type', key: 'type' },
  { title: 'URL', dataIndex: 'jdbcUrl', key: 'jdbcUrl' },
  { title: 'User', dataIndex: 'username', key: 'username' },
  { title: 'Status', dataIndex: 'status', key: 'status' },
  { title: 'Action', key: 'action', width: 330 }
]

const logColumns = [
  { title: 'Time', dataIndex: 'createdAt', key: 'createdAt', width: 190 },
  { title: 'Success', dataIndex: 'success', key: 'success', width: 90 },
  { title: 'Elapsed', dataIndex: 'elapsedMillis', key: 'elapsedMillis', width: 100 },
  { title: 'Message', dataIndex: 'message', key: 'message' }
]

async function load() {
  items.value = await listDataSources()
}

async function save() {
  saving.value = true
  try {
    const payload = { ...form }
    if (editingId.value) {
      await updateDataSource(editingId.value, payload)
    } else {
      await createDataSource(payload)
    }
    message.success(editingId.value ? 'Datasource updated' : 'Datasource created')
    reset()
    await load()
  } finally {
    saving.value = false
  }
}

function edit(record: DataSourceItem) {
  editingId.value = record.id
  form.name = record.name
  form.type = record.type
  form.jdbcUrl = record.jdbcUrl
  form.username = record.username || ''
  form.password = ''
  form.readOnly = record.readOnly
  form.poolConfigJson = record.poolConfigJson || '{}'
}

async function remove(id: string) {
  await deleteDataSource(id)
  if (editingId.value === id) reset()
  message.success('Datasource deleted')
  await load()
}

function reset() {
  editingId.value = null
  form.name = 'Local PostgreSQL'
  form.type = 'POSTGRESQL'
  form.jdbcUrl = 'jdbc:postgresql://localhost:5432/koravo'
  form.username = 'koravo'
  form.password = ''
  form.readOnly = true
  form.poolConfigJson = '{}'
}

async function test(id: string) {
  const result = await testDataSource(id)
  message.info(JSON.stringify(result))
  await openLogs(id)
}

async function openDetail(id: string) {
  detail.value = await getDataSource(id)
  detailOpen.value = true
}

async function openLogs(id: string) {
  const page = await listDataSourceTestLogs(id)
  logs.value = page.items
  logsOpen.value = true
}

onMounted(load)
</script>
