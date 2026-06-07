<template>
  <PageContainer>
    <PageHeader title="数据源管理" description="维护 JDBC 连接，验证连通性和只读策略。">
      <template #actions>
        <a-button :loading="loading" @click="load"><ReloadOutlined />刷新</a-button>
      </template>
    </PageHeader>

    <div class="connector-result-grid panel-block">
      <MetricCard label="数据源" :value="items.length" description="当前租户" />
      <MetricCard label="可用连接" :value="activeCount" status="READY" description="已启用" />
      <MetricCard label="只读连接" :value="readOnlyCount" status="OK" description="禁止写入操作" />
    </div>

    <DetailSection :title="editingId ? '编辑数据源' : '新增数据源'">
      <template #actions>
        <a-space wrap>
          <a-button
            v-for="template in datasourceTemplates"
            :key="template.type"
            :type="form.type === template.type ? 'primary' : 'default'"
            @click="applyTemplate(template.type)"
          >
            {{ template.name }}
          </a-button>
        </a-space>
      </template>
      <a-form layout="vertical" class="form-grid datasource-form">
        <a-form-item label="名称"><a-input v-model:value="form.name" /></a-form-item>
        <a-form-item label="类型">
          <a-select v-model:value="form.type" @change="applyTemplate(form.type)">
            <a-select-option value="POSTGRESQL">PostgreSQL</a-select-option>
            <a-select-option value="MYSQL">MySQL</a-select-option>
            <a-select-option value="H2">H2</a-select-option>
          </a-select>
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
        <a-form-item label="只读">
          <a-switch v-model:checked="form.readOnly" />
          <span class="switch-note">{{ form.readOnly ? '连接测试和连接器读取使用' : '允许写入配置' }}</span>
        </a-form-item>
        <a-form-item class="span-2">
          <a-collapse>
            <a-collapse-panel key="pool" header="高级配置">
              <p class="datasource-hint">连接池参数默认留空，只有需要覆盖超时或池大小时填写。</p>
              <JsonEditor v-model="form.poolConfigJson" :rows="5" object-only />
            </a-collapse-panel>
          </a-collapse>
        </a-form-item>
        <a-form-item class="span-2">
          <Toolbar>
            <a-button type="primary" :loading="saving" @click="save">
              <DatabaseOutlined />{{ editingId ? '更新数据源' : '创建数据源' }}
            </a-button>
            <a-button v-if="editingId" @click="reset">取消编辑</a-button>
          </Toolbar>
        </a-form-item>
      </a-form>
    </DetailSection>

    <a-alert
      class="panel-block"
      type="info"
      show-icon
      message="数据源只用于连接测试和连接器配置"
      description="当前控制台不提供任意 SQL 执行入口。密码加密保存，编辑时不回显。"
    />

    <a-table :data-source="items" :columns="columns" row-key="id" :loading="loading" :pagination="false" class="panel-block">
      <template #emptyText>
        <EmptyState description="暂无数据源" />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <StatusTag :status="record.status" />
        </template>
        <template v-else-if="column.key === 'jdbcUrl'">
          <span class="datasource-url">{{ record.jdbcUrl }}</span>
        </template>
        <template v-else-if="column.key === 'readOnly'">
          {{ record.readOnly ? '只读' : '可写' }}
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
      <a-alert
        v-if="logsDataSourceName"
        class="panel-block"
        type="info"
        show-icon
        :message="logsDataSourceName"
        description="仅记录连接测试结果，不记录密码。"
      />
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
          <template v-else-if="column.key === 'createdAt'">
            {{ formatDateTime(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'elapsedMillis'">
            {{ formatDuration(record.elapsedMillis) }}
          </template>
          <template v-else-if="column.key === 'message'">
            <span class="datasource-message">{{ maskText(record.message) }}</span>
          </template>
        </template>
      </a-table>
    </a-modal>

    <a-modal v-model:open="detailOpen" title="数据源详情" :footer="null" width="760px">
      <a-descriptions v-if="detail" bordered :column="2" size="small">
        <a-descriptions-item label="名称">{{ detail.name }}</a-descriptions-item>
        <a-descriptions-item label="类型">{{ detail.type }}</a-descriptions-item>
        <a-descriptions-item label="JDBC URL">{{ detail.jdbcUrl }}</a-descriptions-item>
        <a-descriptions-item label="用户名">{{ detail.username }}</a-descriptions-item>
        <a-descriptions-item label="驱动">{{ detail.driverClassName }}</a-descriptions-item>
        <a-descriptions-item label="只读">{{ detail.readOnly ? '是' : '否' }}</a-descriptions-item>
        <a-descriptions-item label="状态"><StatusTag :status="detail.status" /></a-descriptions-item>
        <a-descriptions-item label="连接池">{{ detailPoolConfigText }}</a-descriptions-item>
      </a-descriptions>
      <a-alert
        v-if="detail"
        class="panel-block"
        type="info"
        show-icon
        message="密码已加密保存"
        description="详情响应不返回密码、密文或 secret 字段。"
      />
      <a-collapse v-if="detail" class="panel-block">
        <a-collapse-panel key="pool" header="高级详情">
          <JsonPreview :value="detailPoolConfig" />
        </a-collapse-panel>
      </a-collapse>
    </a-modal>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message, type TablePaginationConfig } from 'ant-design-vue'
import { DatabaseOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import JsonPreview from '../components/JsonPreview.vue'
import { DetailSection, EmptyState, JsonEditor, MetricCard, PageContainer, PageHeader, StatusTag, Toolbar } from '../components/ui'
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
import { formatDateTime, formatDuration, maskSecret, parseJsonSafe } from '../utils/format'

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

const activeCount = computed(() => items.value.filter((item) => item.status === 'ACTIVE').length)
const readOnlyCount = computed(() => items.value.filter((item) => item.readOnly).length)
const logsDataSourceName = computed(() => items.value.find((item) => item.id === logsDataSourceId.value)?.name || '')
const detailPoolConfig = computed(() => parseJsonSafe(detail.value?.poolConfigJson || '{}', {}))
const detailPoolConfigText = computed(() => {
  const raw = detail.value?.poolConfigJson?.trim()
  return raw && raw !== '{}' ? '已自定义' : '默认配置'
})

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '类型', dataIndex: 'type', key: 'type' },
  { title: 'URL', key: 'jdbcUrl' },
  { title: '用户', dataIndex: 'username', key: 'username' },
  { title: '权限', key: 'readOnly', width: 90 },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '操作', key: 'action', width: 330 }
]

const logColumns = [
  { title: '时间', key: 'createdAt', width: 160 },
  { title: '结果', key: 'success', width: 90 },
  { title: '耗时', key: 'elapsedMillis', width: 100 },
  { title: '消息', key: 'message' }
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
    parseJsonObject(form.poolConfigJson || '{}', '连接池配置')
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

function maskText(value?: string) {
  const masked = maskSecret(value || '-')
  return typeof masked === 'string' ? masked : JSON.stringify(masked)
}

onMounted(load)
</script>

<style scoped>
.datasource-form {
  margin: 0;
}

.switch-note {
  margin-left: 10px;
  color: #60706a;
  font-size: 13px;
}

.datasource-hint {
  margin-bottom: 10px;
}

.datasource-url,
.datasource-message {
  display: inline-block;
  overflow: hidden;
  max-width: 420px;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
</style>
