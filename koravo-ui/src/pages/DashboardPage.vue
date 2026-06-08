<template>
  <PageContainer>
    <PageHeader title="工作台" description="待办、运行、异常和集成状态。">
      <template #actions>
        <a-button :loading="loading" @click="load"><ReloadOutlined />刷新</a-button>
        <a-button :loading="initializing" @click="initializeAssets"><ThunderboltOutlined />初始化配置</a-button>
        <a-button type="primary" @click="router.push('/process-instances')"><PlayCircleOutlined />启动流程</a-button>
      </template>
    </PageHeader>

    <a-alert
      v-if="dashboardError"
      type="warning"
      show-icon
      class="panel-block"
      message="摘要加载失败"
      :description="dashboardError"
    />

    <div v-if="loading && !summary" class="workbench-grid compact-metric-grid">
      <a-skeleton v-for="item in 4" :key="item" active />
    </div>

    <template v-else>
      <section class="ops-status-strip">
        <div class="ops-status-cell ops-status-strong">
          <span>服务状态</span>
          <div><StatusTag :status="summary?.healthStatus || 'UNKNOWN'" /> <small>核心服务</small></div>
        </div>
        <div v-for="item in contextItems" :key="item.label" class="ops-status-cell">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </section>

      <div class="ops-main-grid">
        <DetailSection title="任务与运行">
          <a-table
            :data-source="taskRows"
            :columns="taskColumns"
            row-key="key"
            size="small"
            :pagination="false"
            class="ops-table"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'name'">
                <div class="ops-row-title">
                  <component :is="record.icon" />
                  <span>
                    <strong>{{ record.name }}</strong>
                    <small>{{ record.description }}</small>
                  </span>
                </div>
              </template>
              <template v-else-if="column.key === 'status'">
                <StatusTag :status="record.status" :text="record.statusText" />
              </template>
              <template v-else-if="column.key === 'action'">
                <a-button type="link" size="small" @click="router.push(record.path)">查看</a-button>
              </template>
            </template>
          </a-table>
          <div class="ops-table-footer">
            <span>刷新时间：{{ summaryTime }}</span>
            <a-button size="small" :loading="loading" @click="load"><ReloadOutlined />刷新全部</a-button>
          </div>
        </DetailSection>

        <DetailSection title="运行概览">
          <div class="ops-overview-list">
            <div v-for="item in overviewItems" :key="item.label">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
              <small v-if="item.meta">{{ item.meta }}</small>
            </div>
          </div>
        </DetailSection>
      </div>

      <div class="ops-bottom-grid">
        <DetailSection title="最近操作">
          <a-table
            v-if="recentRows.length"
            :data-source="recentRows"
            :columns="recentColumns"
            row-key="id"
            size="small"
            :pagination="false"
            class="ops-table"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'action'">{{ actionLabel(record.action) }}</template>
              <template v-else-if="column.key === 'resource'">{{ resourceLabel(record.resourceType) }}</template>
              <template v-else-if="column.key === 'createdAt'">{{ formatDateTime(record.createdAt) }}</template>
              <template v-else-if="column.key === 'result'"><StatusTag status="SUCCESS" text="成功" /></template>
              <template v-else-if="column.key === 'requestId'">
                <CopyableText :value="record.requestId" :display-value="requestIdLabel(record.requestId)" />
              </template>
            </template>
          </a-table>
          <EmptyState v-else description="暂无审计记录" />
        </DetailSection>

        <DetailSection title="流程资产">
          <div class="ops-asset-list">
            <a-button v-for="item in assetRows" :key="item.key" class="ops-asset-item" type="text" @click="router.push(item.path)">
              <span>
                <component :is="item.icon" />
                {{ item.label }}
              </span>
              <strong>{{ item.value }}</strong>
              <small>{{ item.meta }}</small>
            </a-button>
          </div>
        </DetailSection>
      </div>
    </template>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ApiOutlined,
  CheckCircleOutlined,
  ControlOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  PartitionOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined
} from '@ant-design/icons-vue'
import { getDashboardSummary, initializeWorkflowAssets, type DashboardSummary } from '../api/koravo'
import { CopyableText, DetailSection, EmptyState, PageContainer, PageHeader, StatusTag } from '../components/ui'
import { useSessionStore } from '../stores/session'
import { formatDateTime } from '../utils/format'
import { productCopy } from '../utils/display'

const session = useSessionStore()
const router = useRouter()
const summary = ref<DashboardSummary | null>(null)
const loading = ref(false)
const initializing = ref(false)
const dashboardError = ref('')

const failedJobCount = computed(() => summary.value?.failedJobCount ?? 0)
const deadLetterJobCount = computed(() => summary.value?.deadLetterJobCount ?? 0)
const exceptionCount = computed(() => failedJobCount.value + deadLetterJobCount.value)
const connectorFailureCount = computed(() => summary.value?.connectorFailedCount ?? summary.value?.connectorSummary?.failed ?? 0)
const summaryTime = computed(() => summary.value?.time ? formatDateTime(summary.value.time) : '-')
const contextItems = computed(() => [
  { label: '租户', value: summary.value?.tenantId || session.tenantId },
  { label: '用户', value: summary.value?.userId || session.userId },
  { label: '追踪号', value: requestIdLabel(session.requestId || session.lastRequestId) || '自动生成' }
])
const taskRows = computed(() => [
  {
    key: 'todo',
    name: '我的待办',
    description: '当前处理人任务',
    total: summary.value?.myTodoCount ?? 0,
    pending: summary.value?.myTodoCount ?? 0,
    needAction: summary.value?.myTodoCount ?? 0,
    running: 0,
    completed: summary.value?.todayCompletedCount ?? 0,
    status: (summary.value?.myTodoCount ?? 0) > 0 ? 'WARN' : 'OK',
    statusText: (summary.value?.myTodoCount ?? 0) > 0 ? '待处理' : '正常',
    path: '/tasks',
    icon: CheckCircleOutlined
  },
  {
    key: 'exceptions',
    name: '异常任务',
    description: '失败与死信任务',
    total: exceptionCount.value,
    pending: failedJobCount.value,
    needAction: exceptionCount.value,
    running: 0,
    completed: 0,
    status: exceptionCount.value > 0 ? 'WARN' : 'OK',
    statusText: exceptionCount.value > 0 ? '需处理' : '正常',
    path: '/ops?tab=exceptions',
    icon: ControlOutlined
  },
  {
    key: 'connectors',
    name: '连接器失败',
    description: 'HTTP 调用失败记录',
    total: connectorFailureCount.value,
    pending: connectorFailureCount.value,
    needAction: connectorFailureCount.value,
    running: 0,
    completed: summary.value?.connectorSuccessCount ?? 0,
    status: connectorFailureCount.value > 0 ? 'WARN' : 'OK',
    statusText: connectorFailureCount.value > 0 ? '需处理' : '正常',
    path: '/http-connector',
    icon: ApiOutlined
  },
  {
    key: 'instances',
    name: '运行实例',
    description: '当前租户流程实例',
    total: summary.value?.runningInstanceCount ?? 0,
    pending: '-',
    needAction: '-',
    running: summary.value?.runningInstanceCount ?? 0,
    completed: summary.value?.todayCompletedCount ?? 0,
    status: 'OK',
    statusText: '正常',
    path: '/process-instances',
    icon: PlayCircleOutlined
  }
])
const overviewItems = computed(() => [
  { label: '平台版本', value: summary.value?.version || '-', meta: '当前构建' },
  { label: '流程模型', value: String(summary.value?.processModelCount ?? 0), meta: `已部署 ${summary.value?.deployedProcessModelCount ?? 0}` },
  { label: '运行实例', value: String(summary.value?.runningInstanceCount ?? 0), meta: '当前租户' },
  { label: 'HTTP 调用', value: String(summary.value?.connectorSummary?.total ?? 0), meta: `失败 ${connectorFailureCount.value}` },
  { label: '成功率', value: connectorSuccessRate.value, meta: '连接器' },
  { label: '系统时间', value: summaryTime.value, meta: 'Asia/Shanghai' }
])
const connectorSuccessRate = computed(() => {
  const success = summary.value?.connectorSummary?.success ?? 0
  const failed = connectorFailureCount.value
  const total = success + failed
  if (!total) return '-'
  return `${((success / total) * 100).toFixed(1)}%`
})
const recentRows = computed(() => summary.value?.recentAuditLogs?.slice(0, 6) || [])
const assetRows = computed(() => [
  { key: 'models', label: '流程模型', value: summary.value?.processModelCount ?? 0, meta: `启用中 ${summary.value?.deployedProcessModelCount ?? 0}`, path: '/process-models', icon: PartitionOutlined },
  { key: 'forms', label: '表单', value: '查看', meta: '任务表单配置', path: '/forms', icon: FileTextOutlined },
  { key: 'instances', label: '流程实例', value: summary.value?.runningInstanceCount ?? 0, meta: '运行中', path: '/process-instances', icon: PlayCircleOutlined },
  { key: 'connectors', label: '集成连接器', value: summary.value?.connectorSummary?.total ?? 0, meta: `失败 ${connectorFailureCount.value}`, path: '/http-connector', icon: DatabaseOutlined }
])

const taskColumns = [
  { title: '队列类型', key: 'name', width: 190 },
  { title: '总数', dataIndex: 'total', key: 'total', width: 76 },
  { title: '待处理', dataIndex: 'pending', key: 'pending', width: 84 },
  { title: '需处理', dataIndex: 'needAction', key: 'needAction', width: 84 },
  { title: '处理中', dataIndex: 'running', key: 'running', width: 84 },
  { title: '已完成', dataIndex: 'completed', key: 'completed', width: 84 },
  { title: '状态', key: 'status', width: 92 },
  { title: '操作', key: 'action', width: 80 }
]
const recentColumns = [
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
  { title: '操作人', dataIndex: 'userId', key: 'userId', width: 90 },
  { title: '操作类型', key: 'action', width: 130 },
  { title: '对象类型', key: 'resource', width: 130 },
  { title: '结果', key: 'result', width: 86 },
  { title: '追踪号', key: 'requestId' }
]

async function load() {
  loading.value = true
  dashboardError.value = ''
  try {
    summary.value = await getDashboardSummary()
  } catch (error: any) {
    dashboardError.value = error?.message || '后端不可用。'
  } finally {
    loading.value = false
  }
}

async function initializeAssets() {
  initializing.value = true
  try {
    const result = await initializeWorkflowAssets()
    message.success(productCopy(result.actions.join('；')) || '流程配置已初始化')
    await load()
  } finally {
    initializing.value = false
  }
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

function requestIdLabel(requestId?: string) {
  if (!requestId) return ''
  return requestId.length > 12 ? `追踪号 ${requestId.slice(-8)}` : requestId
}

onMounted(load)
</script>
