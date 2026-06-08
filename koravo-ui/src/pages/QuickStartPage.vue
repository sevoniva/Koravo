<template>
  <PageContainer>
    <PageHeader title="快速开始" description="跑通请假审批。">
      <template #actions>
        <a-button :loading="statusLoading" @click="loadStatus"><ReloadOutlined />刷新状态</a-button>
        <a-button type="primary" :loading="initLoading" @click="initDemo"><ThunderboltOutlined />准备基础数据</a-button>
      </template>
    </PageHeader>

    <a-alert
      :type="demoStatus?.initialized ? 'success' : 'warning'"
      :message="statusMessage"
      :description="statusDescription"
      show-icon
    />

    <div class="two-column-grid panel-block">
      <div class="quick-step-list">
        <div v-for="(step, index) in steps" :key="step.key" class="quick-step">
          <span class="quick-step-index">{{ index + 1 }}</span>
          <div>
            <h3>{{ step.title }} <StatusTag :status="step.ready" :text="step.statusText" /></h3>
            <p>{{ step.message }}</p>
          </div>
          <a-button :type="step.primary ? 'primary' : 'default'" :loading="step.loading" @click="step.action">
            {{ step.actionText }}
          </a-button>
        </div>
      </div>

      <DetailSection title="流程准备">
        <a-descriptions :column="1" bordered size="small">
          <a-descriptions-item label="租户">{{ demoStatus?.tenantId || 'default' }}</a-descriptions-item>
          <a-descriptions-item label="用户">{{ demoStatus?.userId || 'admin' }}</a-descriptions-item>
          <a-descriptions-item label="流程">请假审批</a-descriptions-item>
          <a-descriptions-item label="流程定义">
            <CopyableText :value="demoStatus?.processDefinitionId" :display-value="readyLabel(demoStatus?.process?.ready)" />
          </a-descriptions-item>
          <a-descriptions-item label="表单">
            <CopyableText :value="demoStatus?.formSchemaId" :display-value="readyLabel(demoStatus?.form?.ready)" />
          </a-descriptions-item>
          <a-descriptions-item label="绑定">
            <CopyableText :value="demoStatus?.formBindingId" :display-value="readyLabel(demoStatus?.binding?.ready)" />
          </a-descriptions-item>
        </a-descriptions>
        <div class="section-subgroup">
          <h3>请假申请摘要</h3>
          <a-descriptions bordered :column="1" size="small">
            <a-descriptions-item v-for="item in defaultVariableSummaryItems" :key="item.key" :label="item.label">
              {{ item.value }}
            </a-descriptions-item>
          </a-descriptions>
        </div>
        <a-collapse class="panel-block">
          <a-collapse-panel key="variables" header="高级详情">
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
import { ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import JsonPreview from '../components/JsonPreview.vue'
import {
  getDemoStatus,
  initDemoData,
  startProcessInstance,
  type DemoStatus,
  type JsonRecord
} from '../api/koravo'
import { CopyableText, DetailSection, PageContainer, PageHeader, StatusTag } from '../components/ui'

const router = useRouter()
const demoStatus = ref<DemoStatus | null>(null)
const statusLoading = ref(false)
const initLoading = ref(false)
const startLoading = ref(false)

const defaultVariables: JsonRecord = {
  applicant: '张三',
  approver: 'admin',
  leaveType: '年假',
  startDate: '2026-06-08',
  endDate: '2026-06-09',
  days: 2,
  reason: '家庭事务',
  attachmentNote: ''
}

const defaultStartVariables = computed(() => demoStatus.value?.defaultStartVariables || defaultVariables)

const defaultVariableSummaryItems = computed(() => variableSummaryItems(defaultStartVariables.value))

const statusMessage = computed(() => {
  if (!demoStatus.value) return '正在检查基础数据'
  return demoStatus.value.initialized ? '基础数据已就绪' : '基础数据未就绪'
})

const statusDescription = computed(() => {
  if (!demoStatus.value) return '检查后端连接。'
  if (demoStatus.value.initialized) {
    return '流程、表单和绑定已就绪。'
  }
  return '创建或复用流程、表单和绑定。'
})

const steps = computed(() => [
  {
    key: 'service',
    title: '检查服务',
    ready: Boolean(demoStatus.value),
    statusText: demoStatus.value ? '已连接' : '待检查',
    message: demoStatus.value ? `用户 ${demoStatus.value.userId}` : '检查服务。',
    actionText: '刷新',
    action: loadStatus,
    loading: statusLoading.value,
    primary: false
  },
  {
    key: 'init',
    title: '准备基础数据',
    ready: Boolean(demoStatus.value?.initialized),
    statusText: demoStatus.value?.initialized ? '已就绪' : '待准备',
    message: demoStatus.value?.binding?.message || '创建流程、表单和绑定。',
    actionText: demoStatus.value?.initialized ? '重新检查' : '准备',
    action: demoStatus.value?.initialized ? loadStatus : initDemo,
    loading: initLoading.value,
    primary: !demoStatus.value?.initialized
  },
  {
    key: 'start',
    title: '启动请假流程',
    ready: Boolean(demoStatus.value?.todo?.ready),
    statusText: demoStatus.value?.todo?.ready ? '已有待办' : '待启动',
    message: demoStatus.value?.todo?.message || '启动请假审批。',
    actionText: '启动流程',
    action: startLeaveProcess,
    loading: startLoading.value,
    primary: Boolean(demoStatus.value?.initialized && !demoStatus.value?.todo?.ready)
  },
  {
    key: 'task',
    title: '处理待办',
    ready: Boolean(demoStatus.value?.todo?.ready),
    statusText: demoStatus.value?.todo?.ready ? `${demoStatus.value?.todo?.count || 0} 个待办` : '暂无待办',
    message: '进入任务页办理。',
    actionText: '我的任务',
    action: () => router.push('/tasks'),
    loading: false,
    primary: false
  },
  {
    key: 'trace',
    title: '查看流程追踪',
    ready: Boolean(demoStatus.value?.audit?.ready),
    statusText: demoStatus.value?.audit?.ready ? '可查看' : '待产生',
    message: '查看流程图和时间线。',
    actionText: '流程实例',
    action: () => router.push('/process-instances'),
    loading: false,
    primary: false
  },
  {
    key: 'audit',
    title: '查看审计日志',
    ready: Boolean(demoStatus.value?.audit?.ready),
    statusText: demoStatus.value?.audit?.ready ? `${demoStatus.value?.audit?.count || 0} 条` : '暂无审计',
    message: demoStatus.value?.audit?.message || '查看操作记录。',
    actionText: '审计日志',
    action: () => router.push('/audit-logs'),
    loading: false,
    primary: false
  }
])

async function loadStatus() {
  statusLoading.value = true
  try {
    demoStatus.value = await getDemoStatus()
  } finally {
    statusLoading.value = false
  }
}

async function initDemo() {
  initLoading.value = true
  try {
    await initDemoData()
    message.success('基础数据已准备')
    await loadStatus()
  } finally {
    initLoading.value = false
  }
}

async function startLeaveProcess() {
  if (!demoStatus.value?.initialized) {
    message.warning('请先准备基础数据')
    return
  }
  startLoading.value = true
  try {
    const instance = await startProcessInstance({
      processDefinitionKey: demoStatus.value.processDefinitionKey,
      businessKey: `LEAVE-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Date.now().toString().slice(-4)}`,
      variables: demoStatus.value.defaultStartVariables || defaultVariables
    })
    message.success('流程已启动')
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
