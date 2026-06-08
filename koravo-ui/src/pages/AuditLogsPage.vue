<template>
  <PageContainer wide>
    <PageHeader title="审计日志" description="关键操作记录。">
      <template #actions>
        <a-button :loading="loading" @click="search"><ReloadOutlined />查询</a-button>
      </template>
    </PageHeader>

    <a-form layout="vertical" class="audit-filter-form">
      <a-form-item label="用户">
        <a-input v-model:value="filters.userId" allow-clear placeholder="可选" />
      </a-form-item>
      <a-form-item label="动作">
        <a-select v-model:value="filters.action" allow-clear placeholder="全部">
          <a-select-option v-for="option in actionOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="资源类型">
        <a-select v-model:value="filters.resourceType" allow-clear placeholder="全部">
          <a-select-option v-for="option in resourceOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="对象">
        <a-input v-model:value="filters.resourceId" allow-clear />
      </a-form-item>
      <a-form-item label="请求">
        <a-input v-model:value="filters.requestId" allow-clear />
      </a-form-item>
      <a-form-item label="开始时间">
        <a-date-picker
          v-model:value="filters.startTime"
          class="audit-date-picker"
          value-format="YYYY-MM-DDTHH:mm:ss"
          show-time
          allow-clear
          placeholder="选择开始时间"
        />
      </a-form-item>
      <a-form-item label="结束时间">
        <a-date-picker
          v-model:value="filters.endTime"
          class="audit-date-picker"
          value-format="YYYY-MM-DDTHH:mm:ss"
          show-time
          allow-clear
          placeholder="选择结束时间"
        />
      </a-form-item>
      <a-form-item label="操作">
        <Toolbar>
          <a-button type="primary" :loading="loading" @click="search">查询</a-button>
          <a-button @click="resetFilters">重置</a-button>
        </Toolbar>
      </a-form-item>
    </a-form>

    <DetailSection title="日志列表">
      <a-table
        class="audit-table"
        :data-source="items"
        :columns="columns"
        row-key="id"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 960 }"
        size="small"
        @change="handleTableChange"
      >
        <template #emptyText>
          <EmptyState description="暂无审计日志" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'createdAt'">
            {{ formatDateTime(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <span class="audit-action">{{ actionLabel(record.action) }}</span>
          </template>
          <template v-else-if="column.key === 'target'">
            <div class="audit-target">
              <strong>{{ resourceLabel(record.resourceType) }}</strong>
              <span>{{ resourceIdLabel(record.resourceId) }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'summary'">
            <span class="audit-summary">{{ detailSummary(record.detailJson, record.action) }}</span>
          </template>
          <template v-else-if="column.key === 'actionView'">
            <a-button size="small" @click="openDetail(record)">查看</a-button>
          </template>
        </template>
      </a-table>

      <div v-if="!loading && items.length" class="audit-mobile-list">
        <article v-for="record in items" :key="record.id" class="audit-card">
          <div class="audit-card-head">
            <span>{{ formatDateTime(record.createdAt) }}</span>
            <strong>{{ actionLabel(record.action) }}</strong>
          </div>
          <div class="audit-card-target">
            <span>{{ resourceLabel(record.resourceType) }}</span>
            <strong>{{ resourceIdLabel(record.resourceId) }}</strong>
          </div>
          <p>{{ detailSummary(record.detailJson, record.action) }}</p>
          <Toolbar>
            <a-button size="small" @click="openDetail(record)">查看</a-button>
          </Toolbar>
        </article>
      </div>
      <EmptyState v-else-if="!loading" class="audit-mobile-list" description="暂无审计日志" />
    </DetailSection>

    <a-modal v-model:open="detailOpen" title="审计详情" :footer="null" width="860px">
      <a-descriptions v-if="selectedAudit" bordered :column="2" size="small" class="panel-block">
        <a-descriptions-item label="时间">{{ formatDateTime(selectedAudit.createdAt) }}</a-descriptions-item>
        <a-descriptions-item label="用户">{{ selectedAudit.userId }}</a-descriptions-item>
        <a-descriptions-item label="动作">{{ actionLabel(selectedAudit.action) }}</a-descriptions-item>
        <a-descriptions-item label="资源">{{ resourceLabel(selectedAudit.resourceType) }}</a-descriptions-item>
        <a-descriptions-item label="对象">
          <CopyableText :value="selectedAudit.resourceId" :display-value="resourceIdLabel(selectedAudit.resourceId)" />
        </a-descriptions-item>
        <a-descriptions-item label="请求">
          <CopyableText :value="selectedAudit.requestId" :display-value="shortTraceLabel(selectedAudit.requestId)" />
        </a-descriptions-item>
        <a-descriptions-item label="客户端 IP">{{ selectedAudit.clientIp || '-' }}</a-descriptions-item>
        <a-descriptions-item label="租户">{{ selectedAudit.tenantId }}</a-descriptions-item>
      </a-descriptions>
      <DetailSection v-if="selectedAudit" title="变更摘要">
        <a-descriptions v-if="selectedAuditSummaryItems.length" bordered :column="2" size="small">
          <a-descriptions-item v-for="item in selectedAuditSummaryItems" :key="item.key" :label="item.label">
            {{ item.value }}
          </a-descriptions-item>
        </a-descriptions>
        <EmptyState v-else description="暂无补充摘要" />
      </DetailSection>
      <a-collapse v-if="selectedAudit" class="panel-block">
        <a-collapse-panel key="detail" header="原始数据">
          <JsonPreview :value="selectedAuditDetail" />
        </a-collapse-panel>
      </a-collapse>
    </a-modal>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { TablePaginationConfig } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import JsonPreview from '../components/JsonPreview.vue'
import { CopyableText, DetailSection, EmptyState, PageContainer, PageHeader, Toolbar } from '../components/ui'
import { listAuditLogs, type AuditLogItem } from '../api/koravo'
import { formatDateTime, maskSecret, parseJsonSafe } from '../utils/format'
import { processDisplayName, shortTraceLabel, taskDefinitionLabel } from '../utils/display'

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
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
  { title: '用户', dataIndex: 'userId', key: 'userId', width: 120 },
  { title: '行为', dataIndex: 'action', key: 'action', width: 160 },
  { title: '对象', key: 'target', width: 260 },
  { title: '摘要', key: 'summary', width: 300 },
  { title: '详情', key: 'actionView', width: 90 }
]

const actionOptions = [
  { value: 'TASK_COMPLETE', label: '完成任务' },
  { value: 'PROCESS_INSTANCE_START', label: '启动流程' },
  { value: 'CONNECTOR_EXECUTE', label: '执行连接器' },
  { value: 'PROCESS_MODEL_DEPLOY', label: '部署模型' },
  { value: 'PROCESS_MODEL_IMPORT', label: '导入模型' },
  { value: 'DEMO_INIT', label: '初始化配置' },
  { value: 'DATASOURCE_CREATE', label: '创建数据源' },
  { value: 'DATASOURCE_TEST', label: '测试数据源' },
  { value: 'DATASOURCE_DELETE', label: '删除数据源' },
  { value: 'FORM_SCHEMA_CREATE', label: '创建表单' },
  { value: 'FORM_SCHEMA_UPDATE', label: '更新表单' },
  { value: 'FORM_BINDING_CREATE', label: '创建绑定' },
  { value: 'FORM_BINDING_UPDATE', label: '更新绑定' },
  { value: 'FORM_BINDING_DELETE', label: '删除绑定' }
]

const resourceOptions = [
  { value: 'TASK', label: '任务' },
  { value: 'PROCESS_INSTANCE', label: '流程实例' },
  { value: 'PROCESS_MODEL', label: '流程模型' },
  { value: 'CONNECTOR_EXECUTION', label: '连接器日志' },
  { value: 'DATASOURCE', label: '数据源' },
  { value: 'DEMO', label: '流程配置' },
  { value: 'FORM_SCHEMA', label: '表单' },
  { value: 'FORM_BINDING', label: '表单绑定' }
]

const pagination = computed<TablePaginationConfig>(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (count) => `共 ${count} 条审计日志`
}))

const selectedAuditSummaryItems = computed(() => detailSummaryItems(selectedAuditDetail.value))

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
  void load()
}

function resetFilters() {
  Object.assign(filters, {
    userId: '',
    action: '',
    resourceType: '',
    resourceId: '',
    requestId: '',
    startTime: '',
    endTime: ''
  })
  search()
}

function handleTableChange(nextPagination: TablePaginationConfig) {
  page.value = nextPagination.current || 1
  pageSize.value = nextPagination.pageSize || 20
  void load()
}

function openDetail(record: AuditLogItem) {
  selectedAudit.value = record
  selectedAuditDetail.value = parseAuditDetail(record.detailJson)
  detailOpen.value = true
}

function parseAuditDetail(value?: string) {
  return maskSecret(parseJsonSafe(value, value || {}))
}

function detailSummary(value?: string, action?: string) {
  const masked = parseAuditDetail(value)
  if (typeof masked === 'string') return masked || '-'
  const entries = detailSummaryItems(masked).slice(0, 3)
  if (!entries.length) return emptySummary(action)
  return entries.map((item) => `${item.label}：${item.value}`).join('，')
}

function detailSummaryItems(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value as Record<string, unknown>)
    .filter(([key, item]) => !isLowSignalDetail(key, item))
    .map(([key, item]) => ({
      key,
      label: detailKeyLabel(key),
      value: formatSummaryValue(item)
    }))
}

function isLowSignalDetail(key: string, value: unknown) {
  if (value === undefined || value === null || value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return /(^id$|id$|requestId|deploymentId|formSchemaId|formBindingId)/i.test(key)
}

function actionLabel(action?: string) {
  const mapping: Record<string, string> = {
    TASK_COMPLETE: '完成任务',
    PROCESS_INSTANCE_START: '启动流程',
    CONNECTOR_EXECUTE: '执行连接器',
    PROCESS_MODEL_DEPLOY: '部署模型',
    PROCESS_MODEL_IMPORT: '导入模型',
    DEMO_INIT: '初始化配置',
    DATASOURCE_CREATE: '创建数据源',
    DATASOURCE_TEST: '测试数据源',
    DATASOURCE_DELETE: '删除数据源',
    FORM_SCHEMA_CREATE: '创建表单',
    FORM_SCHEMA_UPDATE: '更新表单',
    FORM_BINDING_CREATE: '创建绑定',
    FORM_BINDING_UPDATE: '更新绑定',
    FORM_BINDING_DELETE: '删除绑定'
  }
  return mapping[action || ''] || action || '-'
}

function resourceLabel(resourceType?: string) {
  const mapping: Record<string, string> = {
    TASK: '任务',
    PROCESS_INSTANCE: '流程实例',
    PROCESS_MODEL: '流程模型',
    CONNECTOR_EXECUTION: '连接器日志',
    DATASOURCE: '数据源',
    DEMO: '流程配置',
    FORM_SCHEMA: '表单',
    FORM_BINDING: '表单绑定'
  }
  return mapping[resourceType || ''] || resourceType || '-'
}

function resourceIdLabel(resourceId?: string) {
  if (!resourceId) return '-'
  const mapping: Record<string, string> = {
    'leave-approval': '请假审批'
  }
  return mapping[resourceId] || shortTraceLabel(resourceId)
}

function emptySummary(action?: string) {
  const mapping: Record<string, string> = {
    DEMO_INIT: '流程配置已就绪',
    FORM_BINDING_CREATE: '绑定已创建',
    FORM_BINDING_UPDATE: '绑定已更新',
    FORM_BINDING_DELETE: '绑定已删除'
  }
  return mapping[action || ''] || '无补充信息'
}

function detailKeyLabel(key: string) {
  const mapping: Record<string, string> = {
    status: '状态',
    businessKey: '业务编号',
    processDefinitionId: '流程',
    processDefinitionKey: '流程',
    statusCode: '状态码',
    connectorType: '连接器',
    elapsedMillis: '耗时',
    requestId: '请求',
    taskId: '任务',
    processInstanceId: '流程实例',
    taskDefinitionKey: '任务节点',
    formSchemaId: '表单',
    formBindingId: '绑定',
    processModelId: '模型',
    type: '类型',
    connected: '连接',
    name: '名称',
    deploymentId: '部署',
    modelKey: '模型',
    formKey: '表单',
    formName: '表单名称',
    version: '版本'
  }
  return mapping[key] || key
}

function formatSummaryValue(value: unknown) {
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (value === undefined || value === null || value === '') return '-'
  const text = detailValueLabel(String(value))
  return text.length > 36 ? `${text.slice(0, 36)}...` : text
}

function detailValueLabel(value: string) {
  const mapping: Record<string, string> = {
    RUNNING: '运行中',
    SUCCESS: '成功',
    FAILED: '失败',
    DRAFT: '草稿',
    DEPLOYED: '已部署',
    COMPLETED: '已完成',
    DISABLED: '已禁用',
    ARCHIVED: '已归档',
    approveTask: '审批请假',
    reviewTask: '确认调用结果',
    leaveApproval: '请假审批',
    httpConnectorDemo: 'HTTP 健康检查',
    http: 'HTTP 调用',
    'leave-form': '请假申请表',
    true: '是',
    false: '否'
  }
  return mapping[value] || processDisplayName(value, taskDefinitionLabel(value))
}

onMounted(load)
</script>

<style scoped>
.audit-filter-form {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr));
  gap: 10px 14px;
  margin-bottom: 14px;
  padding: 12px 14px;
  background: var(--color-surface-strong);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.audit-filter-form :deep(.ant-form-item) {
  margin-bottom: 0;
}

.audit-date-picker {
  width: 100%;
}

.audit-summary {
  display: inline-block;
  overflow: hidden;
  max-width: 250px;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.audit-action {
  font-weight: 600;
}

.audit-target {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.audit-target strong,
.audit-target span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audit-target span {
  color: var(--color-muted);
  font-size: 12px;
}

.audit-mobile-list {
  display: none;
}

.audit-card {
  display: grid;
  gap: 8px;
  padding: 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.audit-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.audit-card-head span,
.audit-card-target strong,
.audit-card p {
  overflow-wrap: anywhere;
}

.audit-card-head span,
.audit-card-target span {
  color: var(--color-muted);
  font-size: 12px;
}

.audit-card-head strong {
  color: var(--color-text);
}

.audit-card-target {
  display: grid;
  gap: 2px;
}

.audit-card-target strong {
  color: var(--color-text);
  font-weight: 600;
}

.audit-card p {
  color: var(--color-text);
  font-size: 13px;
  line-height: 1.5;
}

@media (max-width: 980px) {
  .audit-filter-form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .audit-filter-form {
    grid-template-columns: 1fr;
  }

  .audit-table {
    display: none;
  }

  .audit-mobile-list {
    display: grid;
    gap: 10px;
  }
}
</style>
