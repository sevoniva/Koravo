<template>
  <PageContainer>
    <PageHeader title="首页" description="运行状态、待办和最近审计。">
      <template #actions>
        <a-button :loading="loading" @click="load"><ReloadOutlined />刷新</a-button>
        <a-button type="primary" :loading="initLoading" @click="initDemo"><ThunderboltOutlined />准备基础数据</a-button>
      </template>
    </PageHeader>

    <div class="workbench-grid">
      <MetricCard label="当前租户" :value="summary?.tenantId || session.tenantId" description="X-Tenant-Id" />
      <MetricCard label="当前用户" :value="summary?.userId || session.userId" description="X-User-Id" />
      <MetricCard label="后端健康" :value="summary?.healthStatus || '-'" :status="summary?.healthStatus" :description="summary?.version" clickable @click="router.push('/system-settings')" />
      <MetricCard label="流程模型" :value="summary?.processModelCount ?? 0" :description="`已部署 ${summary?.deployedProcessModelCount ?? 0}`" clickable @click="router.push('/process-models')" />
      <MetricCard label="运行中实例" :value="summary?.runningInstanceCount ?? 0" description="当前租户" clickable @click="router.push('/process-instances')" />
      <MetricCard label="我的待办" :value="summary?.myTodoCount ?? 0" description="当前用户" clickable @click="router.push('/tasks')" />
      <MetricCard label="今日完成" :value="summary?.todayCompletedCount ?? 0" description="已办任务" clickable @click="router.push('/tasks')" />
      <MetricCard label="HTTP Connector" :value="`${summary?.connectorSuccessCount ?? 0} / ${summary?.connectorFailedCount ?? 0}`" description="成功 / 失败" clickable @click="router.push('/connector-demo')" />
      <MetricCard label="失败任务" :value="summary?.failedJobCount ?? 0" :status="(summary?.failedJobCount ?? 0) > 0 ? 'WARN' : 'OK'" description="待处理异常" clickable @click="router.push('/ops?tab=failed')" />
      <MetricCard label="死信任务" :value="summary?.deadLetterJobCount ?? 0" :status="(summary?.deadLetterJobCount ?? 0) > 0 ? 'WARN' : 'OK'" description="需人工处理" clickable @click="router.push('/ops?tab=dead-letter')" />
      <MetricCard label="请求 ID" :value="session.requestId || '自动生成'" description="可在顶部修改" />
      <MetricCard label="最近响应" :value="session.lastRequestId || '-'" description="请求追踪号" />
    </div>

    <DetailSection title="快捷入口">
      <a-space wrap>
        <a-button type="primary" :loading="initLoading" @click="initDemo"><ThunderboltOutlined />准备基础数据</a-button>
        <a-button @click="router.push('/process-instances')"><PlayCircleOutlined />启动请假流程</a-button>
        <a-button @click="router.push('/tasks')"><CheckCircleOutlined />我的待办</a-button>
        <a-button @click="router.push('/process-instances')"><PartitionOutlined />流程实例</a-button>
        <a-button @click="router.push('/connector-demo')"><ApiOutlined />HTTP 连接器</a-button>
        <a-button @click="router.push('/ops')"><ControlOutlined />运维中心</a-button>
      </a-space>
    </DetailSection>

    <div class="two-column-grid">
      <DetailSection title="最近审计">
        <EmptyState v-if="!summary?.recentAuditLogs?.length" description="暂无审计记录" />
        <div v-else class="audit-list">
          <div v-for="item in summary.recentAuditLogs" :key="item.id" class="audit-list-item">
            <strong>{{ actionLabel(item.action) }}</strong>
            <span>{{ resourceLabel(item.resourceType) }} · {{ item.userId }} · {{ formatDateTime(item.createdAt) }}</span>
            <CopyableText :value="item.requestId" :display-value="requestIdLabel(item.requestId)" />
          </div>
        </div>
      </DetailSection>

      <DetailSection title="连接器摘要">
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item label="总数">{{ summary?.connectorSummary?.total ?? 0 }}</a-descriptions-item>
          <a-descriptions-item label="成功">{{ summary?.connectorSummary?.success ?? 0 }}</a-descriptions-item>
          <a-descriptions-item label="失败">{{ summary?.connectorSummary?.failed ?? 0 }}</a-descriptions-item>
        </a-descriptions>
        <a-alert
          v-if="summary?.connectorSummary?.recentFailures?.length"
          class="panel-block"
          type="warning"
          show-icon
          message="存在连接器失败"
          description="进入 HTTP 连接器或运维中心查看详情。"
        />
      </DetailSection>
    </div>

    <a-skeleton v-if="loading && !summary" active />
  </PageContainer>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ApiOutlined,
  CheckCircleOutlined,
  ControlOutlined,
  PartitionOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined
} from '@ant-design/icons-vue'
import { getDashboardSummary, initDemoData, type DashboardSummary } from '../api/koravo'
import { CopyableText, DetailSection, EmptyState, MetricCard, PageContainer, PageHeader } from '../components/ui'
import { useSessionStore } from '../stores/session'
import { formatDateTime } from '../utils/format'

const session = useSessionStore()
const router = useRouter()
const summary = ref<DashboardSummary | null>(null)
const loading = ref(false)
const initLoading = ref(false)

async function load() {
  loading.value = true
  try {
    summary.value = await getDashboardSummary()
  } finally {
    loading.value = false
  }
}

async function initDemo() {
  initLoading.value = true
  try {
    const result = await initDemoData()
    message.success(result.actions.join('；'))
    await load()
  } finally {
    initLoading.value = false
  }
}

function actionLabel(action?: string) {
  const mapping: Record<string, string> = {
    TASK_COMPLETE: '完成任务',
    PROCESS_INSTANCE_START: '启动流程',
    CONNECTOR_EXECUTE: '执行连接器',
    PROCESS_MODEL_DEPLOY: '部署模型',
    PROCESS_MODEL_IMPORT: '导入模型',
    DEMO_INIT: '准备基础数据',
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
    DEMO: '基础数据',
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
