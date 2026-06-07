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
    </div>

    <JsonPreview :value="health" />
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import JsonPreview from '../components/JsonPreview.vue'
import { getHealth, type HealthInfo } from '../api/koravo'
import { useSessionStore } from '../stores/session'

const session = useSessionStore()
const health = ref<HealthInfo | null>(null)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    health.value = await getHealth()
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
