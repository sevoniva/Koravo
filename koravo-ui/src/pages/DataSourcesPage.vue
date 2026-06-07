<template>
  <PageContainer>
    <PageHeader title="数据源管理" description="维护 JDBC 数据源配置并测试连接。">
      <template #actions>
        <a-button :loading="loading" @click="load"><ReloadOutlined />刷新</a-button>
      </template>
    </PageHeader>

    <a-form layout="vertical" class="form-grid">
      <a-form-item label="名称"><a-input v-model:value="form.name" /></a-form-item>
      <a-form-item label="类型">
        <a-select v-model:value="form.type" @change="applyTemplate(form.type)">
          <a-select-option value="POSTGRESQL">PostgreSQL</a-select-option>
          <a-select-option value="MYSQL">MySQL</a-select-option>
          <a-select-option value="H2">H2</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="模板" class="span-2">
        <a-space wrap>
          <a-button v-for="template in datasourceTemplates" :key="template.type" @click="applyTemplate(template.type)">
            {{ template.name }}
          </a-button>
        </a-space>
      </a-form-item>
      <a-form-item label="JDBC URL" class="span-2"><a-input v-model:value="form.jdbcUrl" /></a-form-item>
      <a-form-item label="用户名"><a-input v-model:value="form.username" /></a-form-item>
      <a-form-item label="密码" :extra="editingId ? '留空表示保留已加密密码。' : undefined">
        <a-input-password
          v-model:value="form.password"
          :placeholder="editingId ? '保留原密码' : '可为空'"
        />
      </a-form-item>
      <a-form-item label="驱动类"><a-input v-model:value="form.driverClassName" /></a-form-item>
      <a-form-item label="只读"><a-switch v-model:checked="form.readOnly" /></a-form-item>
      <a-form-item label="连接池配置 JSON" class="span-2">
        <a-textarea v-model:value="form.poolConfigJson" :rows="4" />
      </a-form-item>
      <a-form-item>
        <Toolbar>
          <a-button type="primary" :loading="saving" @click="save">
            <DatabaseOutlined />{{ editingId ? '更新' : '创建' }}
          </a-button>
          <a-button v-if="editingId" @click="reset">取消</a-button>
        </Toolbar>
      </a-form-item>
    </a-form>

    <a-alert
      class="panel-block"
      type="info"
      show-icon
      message="数据源只用于连接测试和连接器配置"
      description="当前控制台不提供任意 SQL 执行入口。密码加密保存，编辑时不回显。"
    />

    <a-table :data-source="items" :columns="columns" row-key="id" :loading="loading" :pagination="false">
      <template #emptyText>
        <EmptyState description="暂无数据源" />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <StatusTag :status="record.status" />
        </template>
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button size="small" @click="openDetail(record.id)">详情</a-button>
            <a-button size="small" @click="edit(record)">编辑</a-button>
            <a-button size="small" @click="test(record.id)">测试</a-button>
            <a-button size="small" @click="openLogs(record.id)">日志</a-button>
            <a-popconfirm title="确认删除该数据源？" ok-text="删除" cancel-text="取消" @confirm="remove(record.id)">
              <a-button size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="logsOpen" title="数据源测试日志" :footer="null" width="760px">
      <a-table
        :data-source="logs"
        :columns="logColumns"
        row-key="id"
        :loading="logsLoading"
        :pagination="logsPagination"
        size="small"
        @change="handleLogsTableChange"
      >
        <template #emptyText>
          <EmptyState description="暂无测试日志" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'success'">
            <StatusTag :status="record.success ? 'SUCCESS' : 'FAILED'" />
          </template>
        </template>
      </a-table>
    </a-modal>

    <a-modal v-model:open="detailOpen" title="数据源详情" :footer="null" width="760px">
      <a-descriptions v-if="detail" bordered :column="2">
        <a-descriptions-item label="名称">{{ detail.name }}</a-descriptions-item>
        <a-descriptions-item label="类型">{{ detail.type }}</a-descriptions-item>
        <a-descriptions-item label="JDBC URL">{{ detail.jdbcUrl }}</a-descriptions-item>
        <a-descriptions-item label="用户名">{{ detail.username }}</a-descriptions-item>
        <a-descriptions-item label="驱动">{{ detail.driverClassName }}</a-descriptions-item>
        <a-descriptions-item label="只读">{{ detail.readOnly ? '是' : '否' }}</a-descriptions-item>
        <a-descriptions-item label="状态"><StatusTag :status="detail.status" /></a-descriptions-item>
        <a-descriptions-item label="连接池配置">{{ detail.poolConfigJson }}</a-descriptions-item>
      </a-descriptions>
      <JsonPreview :value="detail" />
    </a-modal>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message, type TablePaginationConfig } from 'ant-design-vue'
import { DatabaseOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import JsonPreview from '../components/JsonPreview.vue'
import { EmptyState, PageContainer, PageHeader, StatusTag, Toolbar } from '../components/ui'
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
import { JsonInputError, parseJsonObject } from '../utils/jsonInput'

const saving = ref(false)
const loading = ref(false)
const editingId = ref<string | null>(null)
const items = ref<DataSourceItem[]>([])
const logsOpen = ref(false)
const logsLoading = ref(false)
const detailOpen = ref(false)
const logs = ref<DataSourceTestLogItem[]>([])
const logsDataSourceId = ref<string | null>(null)
const logsPage = ref(1)
const logsPageSize = ref(10)
const logsTotal = ref(0)
const detail = ref<DataSourceItem | null>(null)
const datasourceTemplates = [
  {
    type: 'POSTGRESQL',
    name: 'PostgreSQL',
    jdbcUrl: 'jdbc:postgresql://localhost:15432/koravo',
    username: 'koravo',
    driverClassName: 'org.postgresql.Driver'
  },
  {
    type: 'MYSQL',
    name: 'MySQL',
    jdbcUrl: 'jdbc:mysql://localhost:3306/koravo?useSSL=false&serverTimezone=Asia/Shanghai',
    username: 'root',
    driverClassName: 'com.mysql.cj.jdbc.Driver'
  },
  {
    type: 'H2',
    name: 'H2',
    jdbcUrl: 'jdbc:h2:mem:koravo',
    username: 'sa',
    driverClassName: 'org.h2.Driver'
  }
]
const form = reactive({
  name: '本地 PostgreSQL',
  type: 'POSTGRESQL',
  jdbcUrl: 'jdbc:postgresql://localhost:15432/koravo',
  username: 'koravo',
  password: '',
  driverClassName: 'org.postgresql.Driver',
  readOnly: true,
  poolConfigJson: '{}'
})

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '类型', dataIndex: 'type', key: 'type' },
  { title: 'URL', dataIndex: 'jdbcUrl', key: 'jdbcUrl' },
  { title: '用户', dataIndex: 'username', key: 'username' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '操作', key: 'action', width: 330 }
]

const logColumns = [
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 190 },
  { title: '成功', dataIndex: 'success', key: 'success', width: 90 },
  { title: '耗时 ms', dataIndex: 'elapsedMillis', key: 'elapsedMillis', width: 100 },
  { title: '消息', dataIndex: 'message', key: 'message' }
]

const logsPagination = computed<TablePaginationConfig>(() => ({
  current: logsPage.value,
  pageSize: logsPageSize.value,
  total: logsTotal.value,
  showSizeChanger: true,
  showTotal: (count) => `共 ${count} 条测试日志`
}))

async function load() {
  loading.value = true
  try {
    items.value = await listDataSources()
  } finally {
    loading.value = false
  }
}

async function save() {
  try {
    parseJsonObject(form.poolConfigJson || '{}', '连接池配置 JSON')
  } catch (error) {
    if (error instanceof JsonInputError) {
      message.error(error.message)
    }
    return
  }
  saving.value = true
  try {
    const payload = { ...form }
    if (editingId.value) {
      await updateDataSource(editingId.value, payload)
    } else {
      await createDataSource(payload)
    }
    message.success(editingId.value ? '数据源已更新' : '数据源已创建')
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
  form.driverClassName = record.driverClassName
  form.readOnly = record.readOnly
  form.poolConfigJson = record.poolConfigJson || '{}'
}

async function remove(id: string) {
  await deleteDataSource(id)
  if (editingId.value === id) reset()
  message.success('数据源已删除')
  await load()
}

function reset() {
  editingId.value = null
  form.name = '本地 PostgreSQL'
  form.type = 'POSTGRESQL'
  form.jdbcUrl = 'jdbc:postgresql://localhost:15432/koravo'
  form.username = 'koravo'
  form.password = ''
  form.driverClassName = 'org.postgresql.Driver'
  form.readOnly = true
  form.poolConfigJson = '{}'
}

function applyTemplate(type: string) {
  const template = datasourceTemplates.find((item) => item.type === type)
  if (!template) return
  form.type = template.type
  form.name = editingId.value ? form.name : `本地 ${template.name}`
  form.jdbcUrl = template.jdbcUrl
  form.username = template.username
  form.driverClassName = template.driverClassName
}

async function test(id: string) {
  const result = await testDataSource(id)
  message[result.connected ? 'success' : 'error'](result.message || (result.connected ? '连接成功' : '连接失败'))
  await openLogs(id)
}

async function openDetail(id: string) {
  detail.value = await getDataSource(id)
  detailOpen.value = true
}

async function openLogs(id: string) {
  logsDataSourceId.value = id
  logsPage.value = 1
  logsOpen.value = true
  await loadLogs()
}

async function loadLogs() {
  if (!logsDataSourceId.value) {
    return
  }
  logsLoading.value = true
  try {
    const page = await listDataSourceTestLogs(logsDataSourceId.value, {
      page: logsPage.value,
      pageSize: logsPageSize.value
    })
    logs.value = page.items
    logsTotal.value = page.total
    logsPage.value = page.page
    logsPageSize.value = page.pageSize
  } finally {
    logsLoading.value = false
  }
}

function handleLogsTableChange(nextPagination: TablePaginationConfig) {
  logsPage.value = nextPagination.current || 1
  logsPageSize.value = nextPagination.pageSize || 10
  loadLogs()
}

onMounted(load)
</script>
