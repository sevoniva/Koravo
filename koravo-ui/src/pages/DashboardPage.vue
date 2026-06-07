<template>
  <PageContainer>
    <PageHeader title="首页" description="运行状态、待办和最近审计。">
      <template #actions>
        <a-button :loading="loading" @click="load"><ReloadOutlined />刷新</a-button>
        <a-button type="primary" :loading="initLoading" @click="initDemo"><ThunderboltOutlined />初始化演示数据</a-button>
      </template>
    </PageHeader>

    <div class="workbench-grid">
      <MetricCard label="当前租户" :value="summary?.tenantId || session.tenantId" description="X-Tenant-Id" />
      <MetricCard label="当前用户" :value="summary?.userId || session.userId" description="X-User-Id" />
      <MetricCard label="后端健康" :value="summary?.healthStatus || '-'" :status="summary?.healthStatus" :description="summary?.version" clickable @click="router.push('/system-settings')" />
      <MetricCard label="流程模型" :value="summary?.processModelCount ?? 0" :description="`已部署 ${summary?.deployedProcessModelCount ?? 0}`" clickable @click="router.push('/process-models')" />
      <MetricCard label="运行中实例" :value="summary?.runningInstanceCount ?? 0" description="当前租户" clickable @click="router.push('/process-instances')" />
      <MetricCard label="我的待办" :value="summary?.myTodoCount ?? 0" description="当前用户" clickable @click="router.push('/tasks')" />
      <MetricCard label="今日完成" :value="summary?.todayCompletedCount ?? 0" description="TASK_COMPLETE" clickable @click="router.push('/tasks')" />
      <MetricCard label="HTTP Connector" :value="`${summary?.connectorSuccessCount ?? 0} / ${summary?.connectorFailedCount ?? 0}`" description="成功 / 失败" clickable @click="router.push('/connector-demo')" />
      <MetricCard label="失败任务" :value="summary?.failedJobCount ?? 0" :status="(summary?.failedJobCount ?? 0) > 0 ? 'WARN' : 'OK'" description="Flowable 作业异常" clickable @click="router.push('/ops?tab=failed')" />
      <MetricCard label="死信任务" :value="summary?.deadLetterJobCount ?? 0" :status="(summary?.deadLetterJobCount ?? 0) > 0 ? 'WARN' : 'OK'" description="Dead letter jobs" clickable @click="router.push('/ops?tab=dead-letter')" />
      <MetricCard label="请求 ID" :value="session.requestId || '自动生成'" description="可在顶部修改" />
      <MetricCard label="最近响应" :value="session.lastRequestId || '-'" description="后端 requestId" />
    </div>

    <DetailSection title="快捷入口">
      <a-space wrap>
        <a-button type="primary" :loading="initLoading" @click="initDemo"><ThunderboltOutlined />初始化演示数据</a-button>
        <a-button @click="router.push('/process-instances')"><PlayCircleOutlined />启动请假流程</a-button>
        <a-button @click="router.push('/tasks')"><CheckCircleOutlined />我的待办</a-button>
        <a-button @click="router.push('/process-instances')"><PartitionOutlined />流程实例</a-button>
        <a-button @click="router.push('/connector-demo')"><ApiOutlined />连接器示例</a-button>
        <a-button @click="router.push('/ops')"><ControlOutlined />运维中心</a-button>
      </a-space>
    </DetailSection>

    <div class="two-column-grid">
      <DetailSection title="最近审计">
        <EmptyState v-if="!summary?.recentAuditLogs?.length" description="暂无审计记录" />
        <div v-else class="audit-list">
          <div v-for="item in summary.recentAuditLogs" :key="item.id" class="audit-list-item">
            <strong>{{ item.action }}</strong>
            <span>{{ item.resourceType }} · {{ item.userId }} · {{ formatDateTime(item.createdAt) }}</span>
            <CopyableText :value="item.requestId" />
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
          description="进入连接器示例或运维中心查看详情。"
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

onMounted(load)
</script>
