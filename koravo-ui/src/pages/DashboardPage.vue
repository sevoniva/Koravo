<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>Dashboard</h1>
        <p>Platform runtime, tenant context, and API health.</p>
      </div>
      <a-button type="primary" :loading="loading" @click="load"><ReloadOutlined />Refresh</a-button>
    </div>

    <div class="metric-grid">
      <a-card title="Platform"><strong>Koravo</strong><span>Flowable-based process and data orchestration</span></a-card>
      <a-card title="Backend"><a-tag :color="health?.status === 'UP' ? 'green' : 'red'">{{ health?.status || 'UNKNOWN' }}</a-tag><span>{{ health?.version }}</span></a-card>
      <a-card title="Tenant"><strong>{{ session.tenantId }}</strong><span>Header X-Tenant-Id</span></a-card>
      <a-card title="User"><strong>{{ session.userId }}</strong><span>Header X-User-Id</span></a-card>
      <a-card title="Request ID"><strong>{{ session.requestId || 'auto-generated' }}</strong><span>Header X-Request-Id</span></a-card>
      <a-card title="Last Response"><strong>{{ session.lastRequestId || '-' }}</strong><span>Response requestId</span></a-card>
      <a-card title="Pending Tasks" hoverable @click="router.push('/tasks')"><strong>{{ pendingTotal }}</strong><span>Current approvals</span></a-card>
      <a-card title="Done Tasks" hoverable @click="router.push('/tasks')"><strong>{{ doneTotal }}</strong><span>Historic approvals</span></a-card>
      <a-card title="Started Instances" hoverable @click="router.push('/process-instances')"><strong>{{ startedTotal }}</strong><span>Started by current user</span></a-card>
      <a-card title="HTTP Connector" hoverable @click="router.push('/ops')">
        <strong>{{ connectorSummary?.success ?? 0 }} / {{ connectorSummary?.failed ?? 0 }}</strong>
        <span>Success / failed executions</span>
      </a-card>
    </div>

    <JsonPreview :value="health" />
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ReloadOutlined } from '@ant-design/icons-vue'
import JsonPreview from '../components/JsonPreview.vue'
import {
  getConnectorExecutionSummary,
  getHealth,
  listDoneTasks,
  listStartedInstances,
  listTasks,
  type ConnectorExecutionSummary,
  type HealthInfo
} from '../api/koravo'
import { useSessionStore } from '../stores/session'

const session = useSessionStore()
const router = useRouter()
const health = ref<HealthInfo | null>(null)
const pendingTotal = ref(0)
const doneTotal = ref(0)
const startedTotal = ref(0)
const connectorSummary = ref<ConnectorExecutionSummary | null>(null)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const [nextHealth, pending, done, started, connectors] = await Promise.all([
      getHealth(),
      listTasks({ page: 1, pageSize: 1 }),
      listDoneTasks({ page: 1, pageSize: 1 }),
      listStartedInstances({ page: 1, pageSize: 1 }),
      getConnectorExecutionSummary('http')
    ])
    health.value = nextHealth
    pendingTotal.value = pending.total
    doneTotal.value = done.total
    startedTotal.value = started.total
    connectorSummary.value = connectors
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
