<template>
  <PageContainer>
    <PageHeader title="系统设置" description="租户、用户、请求头和运行状态。">
      <template #actions>
        <a-button :loading="loading" @click="load"><ReloadOutlined />刷新</a-button>
        <a-button type="primary" @click="save"><SaveOutlined />保存</a-button>
      </template>
    </PageHeader>

    <div class="two-column-grid">
      <DetailSection title="请求上下文">
        <a-form layout="vertical">
          <a-form-item label="租户">
            <a-input v-model:value="tenantId" />
          </a-form-item>
          <a-form-item label="用户">
            <a-input v-model:value="userId" />
          </a-form-item>
          <a-form-item label="请求 ID">
            <a-input v-model:value="requestId" placeholder="不填则后端生成" />
          </a-form-item>
        </a-form>
        <a-space wrap>
          <a-button type="primary" @click="save">保存设置</a-button>
          <a-button @click="clearLocal">清除本地设置</a-button>
          <a-button :loading="initLoading" @click="initDemo"><ThunderboltOutlined />准备基础数据</a-button>
        </a-space>
      </DetailSection>

      <DetailSection title="请求头预览">
        <a-descriptions :column="1" bordered size="small">
          <a-descriptions-item label="API 地址">/api/v1</a-descriptions-item>
          <a-descriptions-item label="X-Tenant-Id">{{ tenantId || 'default' }}</a-descriptions-item>
          <a-descriptions-item label="X-User-Id">{{ userId || 'admin' }}</a-descriptions-item>
          <a-descriptions-item label="X-Request-Id">{{ requestId || '自动生成' }}</a-descriptions-item>
          <a-descriptions-item label="最近响应">
            <CopyableText :value="session.lastRequestId" :display-value="requestIdLabel(session.lastRequestId)" />
          </a-descriptions-item>
        </a-descriptions>
      </DetailSection>
    </div>

    <DetailSection title="系统健康">
      <a-descriptions :column="2" bordered>
        <a-descriptions-item label="整体状态"><StatusTag :status="health?.status" /></a-descriptions-item>
        <a-descriptions-item label="版本">{{ health?.version || '-' }}</a-descriptions-item>
        <a-descriptions-item label="租户">{{ health?.tenantId || session.tenantId }}</a-descriptions-item>
        <a-descriptions-item label="用户">{{ health?.userId || session.userId }}</a-descriptions-item>
        <a-descriptions-item label="基础数据">{{ demoModeLabel }}</a-descriptions-item>
        <a-descriptions-item label="URL 策略">{{ health?.urlPolicy?.message || '-' }}</a-descriptions-item>
      </a-descriptions>

      <a-table
        class="panel-block"
        :data-source="health?.dependencies || []"
        :columns="columns"
        row-key="key"
        :pagination="false"
      >
        <template #emptyText>
          <a-empty description="暂无健康数据" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <StatusTag :status="record.status" />
          </template>
        </template>
      </a-table>
    </DetailSection>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, SaveOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import { getSystemHealth, initDemoData, type SystemHealth } from '../api/koravo'
import { CopyableText, DetailSection, PageContainer, PageHeader, StatusTag } from '../components/ui'
import { useSessionStore } from '../stores/session'

const session = useSessionStore()
const tenantId = ref(session.tenantId)
const userId = ref(session.userId)
const requestId = ref(session.requestId)
const health = ref<SystemHealth | null>(null)
const loading = ref(false)
const initLoading = ref(false)
const demoModeLabel = computed(() => health.value?.demoMode?.enabled ? '可准备' : '未启用')

const columns = [
  { title: '组件', dataIndex: 'name', key: 'name' },
  { title: '状态', key: 'status', width: 120 },
  { title: '说明', dataIndex: 'message', key: 'message' }
]

async function load() {
  loading.value = true
  try {
    health.value = await getSystemHealth()
  } finally {
    loading.value = false
  }
}

function save() {
  session.setTenantId(tenantId.value)
  session.setUserId(userId.value)
  session.setRequestId(requestId.value)
  message.success('设置已保存')
  void load()
}

function clearLocal() {
  tenantId.value = 'default'
  userId.value = 'admin'
  requestId.value = ''
  save()
}

async function initDemo() {
  initLoading.value = true
  try {
    await initDemoData()
    message.success('基础数据已准备')
  } finally {
    initLoading.value = false
  }
}

function requestIdLabel(requestId?: string) {
  if (!requestId) return ''
  return requestId.length > 12 ? `追踪号 ${requestId.slice(-8)}` : requestId
}

onMounted(load)
</script>
