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
        <a-button type="primary" :loading="saving" @click="create"><DatabaseOutlined />Create</a-button>
      </a-form-item>
    </a-form>

    <a-table :data-source="items" :columns="columns" row-key="id" :pagination="false">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-button size="small" @click="test(record.id)">Test</a-button>
        </template>
      </template>
    </a-table>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { DatabaseOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { createDataSource, listDataSources, testDataSource, type DataSourceItem } from '../api/koravo'

const saving = ref(false)
const items = ref<DataSourceItem[]>([])
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
  { title: 'Action', key: 'action', width: 100 }
]

async function load() {
  items.value = await listDataSources()
}

async function create() {
  saving.value = true
  try {
    await createDataSource(form)
    message.success('Datasource created')
    form.password = ''
    await load()
  } finally {
    saving.value = false
  }
}

async function test(id: string) {
  const result = await testDataSource(id)
  message.info(JSON.stringify(result))
}

onMounted(load)
</script>
