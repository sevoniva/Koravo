<template>
  <PageContainer>
    <PageHeader title="流程启用" description="启用请假审批并完成首个流转。">
      <template #actions>
        <a-button :loading="statusLoading" @click="loadStatus"><ReloadOutlined />刷新</a-button>
        <a-button :loading="initializing" @click="initializeAssets"><ThunderboltOutlined />初始化配置</a-button>
        <a-button type="primary" :loading="startLoading" @click="startLeaveProcess"><PlayCircleOutlined />启动申请</a-button>
      </template>
    </PageHeader>

    <a-alert
      :type="isInitialized ? 'success' : 'warning'"
      :message="statusMessage"
      :description="statusDescription"
      show-icon
    />

    <div class="enablement-grid panel-block">
      <section class="enablement-step-panel">
        <div class="enablement-heading">
          <div>
            <span class="section-eyebrow">启用步骤</span>
            <h2>请假审批</h2>
          </div>
          <a-button type="primary" :loading="stageAction.loading" @click="stageAction.action">
            <component :is="stageAction.icon" />{{ stageAction.label }}
          </a-button>
        </div>

        <a-table
          :data-source="stepRows"
          :columns="stepColumns"
          row-key="key"
          size="small"
          :pagination="false"
          class="ops-table"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'step'">
              <div class="enablement-table-step">
                <span>{{ record.index }}</span>
                <strong>{{ record.title }}</strong>
              </div>
            </template>
            <template v-else-if="column.key === 'status'">
              <StatusTag :status="record.ready" :text="record.statusText" />
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button type="link" size="small" @click="record.action">{{ record.actionText }}</a-button>
            </template>
          </template>
        </a-table>
      </section>

      <aside class="enablement-current-card">
        <h3>当前流程</h3>
        <strong>请假审批流程</strong>
        <div class="enablement-progress-line">
          <span>整体进度</span>
          <a-progress :percent="progressPercent" :show-info="false" size="small" />
          <small>{{ progressPercent }}%</small>
        </div>
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item label="当前阶段">{{ stageTitle }}</a-descriptions-item>
          <a-descriptions-item label="申请单号">{{ businessKeyPreview }}</a-descriptions-item>
          <a-descriptions-item label="发起人">{{ session.userId || 'admin' }}</a-descriptions-item>
          <a-descriptions-item label="处理人">admin</a-descriptions-item>
        </a-descriptions>
        <a-button block danger :disabled="!enablementStatus?.todo?.ready" @click="router.push('/tasks')">处理待办</a-button>
      </aside>
    </div>

    <div class="enablement-detail-grid">
      <DetailSection title="申请参数">
        <a-descriptions bordered :column="1" size="small">
          <a-descriptions-item v-for="item in defaultVariableSummaryItems" :key="item.key" :label="item.label">
            {{ item.value }}
          </a-descriptions-item>
        </a-descriptions>
      </DetailSection>

      <DetailSection title="资源状态">
        <div class="workflow-resource-strip">
          <div>
            <span>流程定义</span>
            <CopyableText :value="enablementStatus?.processDefinitionId" :display-value="readyLabel(enablementStatus?.process?.ready)" />
          </div>
          <div>
            <span>表单版本</span>
            <CopyableText :value="enablementStatus?.formSchemaId" :display-value="readyLabel(enablementStatus?.form?.ready)" />
          </div>
          <div>
            <span>节点绑定</span>
            <CopyableText :value="enablementStatus?.formBindingId" :display-value="readyLabel(enablementStatus?.binding?.ready)" />
          </div>
        </div>
        <a-collapse class="panel-block">
          <a-collapse-panel key="variables" header="变量 JSON">
            <JsonPreview :value="defaultStartVariables" />
          </a-collapse-panel>
        </a-collapse>
      </DetailSection>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { CheckCircleOutlined, PlayCircleOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import JsonPreview from '../components/JsonPreview.vue'
import {
  getWorkflowEnablementStatus,
  initializeWorkflowAssets,
  startProcessInstance,
  type JsonRecord,
  type WorkflowEnablementStatus
} from '../api/koravo'
import { CopyableText, DetailSection, PageContainer, PageHeader, StatusTag } from '../components/ui'
import { useSessionStore } from '../stores/session'
import { productCopy } from '../utils/display'

const router = useRouter()
const session = useSessionStore()
const enablementStatus = ref<WorkflowEnablementStatus | null>(null)
const statusLoading = ref(false)
const initializing = ref(false)
const startLoading = ref(false)
const todayCompact = new Date().toISOString().slice(0, 10).replaceAll('-', '')

const defaultVariables = computed<JsonRecord>(() => ({
  applicant: session.userId || 'admin',
  approver: 'admin',
  leaveType: '年假',
  startDate: '2026-06-08',
  endDate: '2026-06-09',
  days: 2,
  reason: '年度休假',
  attachmentNote: ''
}))

const defaultStartVariables = computed(() => enablementStatus.value?.defaultStartVariables || defaultVariables.value)
const defaultVariableSummaryItems = computed(() => variableSummaryItems(defaultStartVariables.value))
const isInitialized = computed(() => Boolean(enablementStatus.value?.initialized))
const progressPercent = computed(() => {
  const readyCount = readinessItems.value.filter((item) => item.ready).length
  return Math.round((readyCount / readinessItems.value.length) * 100)
})
const businessKeyPreview = computed(() => `LEAVE-${todayCompact}-0001`)
const statusMessage = computed(() => {
  if (!enablementStatus.value) return '正在检查流程配置'
  return isInitialized.value ? '流程配置已就绪' : '流程配置待初始化'
})
const statusDescription = computed(() => {
  if (!enablementStatus.value) return '正在读取流程、表单和节点绑定。'
  if (isInitialized.value) return '可以启动申请并进入待办处理。'
  return '初始化后会创建或复用流程、表单和节点绑定。'
})
const stageTitle = computed(() => {
  if (!isInitialized.value) return '初始化配置'
  if (!enablementStatus.value?.todo?.ready) return '启动申请'
  return '办理任务'
})
const stageAction = computed(() => {
  if (!isInitialized.value) return { label: '初始化配置', icon: ThunderboltOutlined, loading: initializing.value, action: initializeAssets }
  if (!enablementStatus.value?.todo?.ready) return { label: '启动申请', icon: PlayCircleOutlined, loading: startLoading.value, action: startLeaveProcess }
  return { label: '处理待办', icon: CheckCircleOutlined, loading: false, action: () => router.push('/tasks') }
})
const readinessItems = computed(() => [
  { key: 'process', label: '流程模型', ready: Boolean(enablementStatus.value?.process?.ready) },
  { key: 'form', label: '任务表单', ready: Boolean(enablementStatus.value?.form?.ready) },
  { key: 'binding', label: '节点绑定', ready: Boolean(enablementStatus.value?.binding?.ready) },
  { key: 'todo', label: '待办任务', ready: Boolean(enablementStatus.value?.todo?.ready) }
])
const stepRows = computed(() => [
  {
    key: 'init',
    index: 1,
    title: '初始化配置',
    ready: isInitialized.value,
    statusText: isInitialized.value ? '已完成' : '待处理',
    description: productCopy(enablementStatus.value?.binding?.message) || '流程、表单、权限和绑定配置',
    owner: 'admin',
    startedAt: isInitialized.value ? '已记录' : '-',
    finishedAt: isInitialized.value ? '已完成' : '-',
    actionText: isInitialized.value ? '查看详情' : '初始化',
    action: isInitialized.value ? loadStatus : initializeAssets
  },
  {
    key: 'start',
    index: 2,
    title: '启动申请',
    ready: Boolean(enablementStatus.value?.todo?.ready),
    statusText: enablementStatus.value?.todo?.ready ? '已完成' : '待处理',
    description: productCopy(enablementStatus.value?.todo?.message) || '提交一条请假申请',
    owner: session.userId || 'admin',
    startedAt: isInitialized.value ? '待执行' : '-',
    finishedAt: enablementStatus.value?.todo?.ready ? '已完成' : '-',
    actionText: '启动申请',
    action: startLeaveProcess
  },
  {
    key: 'task',
    index: 3,
    title: '办理任务',
    ready: Boolean(enablementStatus.value?.todo?.ready),
    statusText: enablementStatus.value?.todo?.ready ? '进行中' : '未开始',
    description: '按表单完成审批任务',
    owner: 'admin',
    startedAt: enablementStatus.value?.todo?.ready ? '待办理' : '-',
    finishedAt: '-',
    actionText: '查看任务',
    action: () => router.push('/tasks')
  },
  {
    key: 'trace',
    index: 4,
    title: '追踪结果',
    ready: Boolean(enablementStatus.value?.audit?.ready),
    statusText: enablementStatus.value?.audit?.ready ? '可查看' : '未开始',
    description: productCopy(enablementStatus.value?.audit?.message) || '查看流程图和监控指标',
    owner: '-',
    startedAt: '-',
    finishedAt: '-',
    actionText: '查看追踪',
    action: () => router.push('/process-instances')
  }
])
const stepColumns = [
  { title: '步骤', key: 'step', width: 160 },
  { title: '状态', key: 'status', width: 100 },
  { title: '说明', dataIndex: 'description', key: 'description' },
  { title: '负责人', dataIndex: 'owner', key: 'owner', width: 90 },
  { title: '开始时间', dataIndex: 'startedAt', key: 'startedAt', width: 110 },
  { title: '完成时间', dataIndex: 'finishedAt', key: 'finishedAt', width: 110 },
  { title: '操作', key: 'action', width: 90 }
]

async function loadStatus() {
  statusLoading.value = true
  try {
    enablementStatus.value = await getWorkflowEnablementStatus()
  } finally {
    statusLoading.value = false
  }
}

async function initializeAssets() {
  initializing.value = true
  try {
    await initializeWorkflowAssets()
    message.success('流程配置已初始化')
    await loadStatus()
  } finally {
    initializing.value = false
  }
}

async function startLeaveProcess() {
  if (!isInitialized.value) {
    message.warning('请先初始化流程配置')
    return
  }
  startLoading.value = true
  try {
    const instance = await startProcessInstance({
      processDefinitionKey: enablementStatus.value?.processDefinitionKey || 'leaveApproval',
      businessKey: `LEAVE-${todayCompact}-${Date.now().toString().slice(-4)}`,
      variables: enablementStatus.value?.defaultStartVariables || defaultVariables.value
    })
    message.success('申请已启动')
    router.push(`/process-instances/${instance.instanceId}`)
  } finally {
    startLoading.value = false
  }
}

function variableSummaryItems(value: JsonRecord) {
  return Object.entries(value)
    .filter(([, item]) => item !== undefined && item !== null && item !== '')
    .map(([key, item]) => ({
      key,
      label: fieldLabel(key),
      value: formatSummaryValue(item)
    }))
}

function fieldLabel(key: string) {
  const mapping: Record<string, string> = {
    applicant: '申请人',
    approver: '审批人',
    leaveType: '请假类型',
    startDate: '开始日期',
    endDate: '结束日期',
    days: '请假天数',
    reason: '请假原因',
    attachmentNote: '附件说明'
  }
  return mapping[key] || key
}

function formatSummaryValue(value: unknown) {
  if (typeof value === 'boolean') return value ? '是' : '否'
  return String(value)
}

function readyLabel(ready?: boolean) {
  return ready ? '已就绪' : '待准备'
}

onMounted(loadStatus)
</script>
