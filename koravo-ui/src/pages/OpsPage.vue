<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>Ops</h1>
        <p>Inspect process instances for operational troubleshooting.</p>
      </div>
      <a-button :loading="loading" @click="load"><ReloadOutlined />Reload</a-button>
    </div>

    <a-table :data-source="instances" :columns="columns" row-key="instanceId" :pagination="false">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-button size="small" @click="inspect(record.instanceId)">Inspect</a-button>
        </template>
      </template>
    </a-table>

    <JsonPreview :value="detail" />
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import JsonPreview from '../components/JsonPreview.vue'
import { getOpsInstance, listOpsInstances } from '../api/koravo'

const loading = ref(false)
const instances = ref<unknown[]>([])
const detail = ref<unknown>(null)

const columns = [
  { title: 'Instance ID', dataIndex: 'instanceId', key: 'instanceId' },
  { title: 'Business Key', dataIndex: 'businessKey', key: 'businessKey' },
  { title: 'Status', dataIndex: 'status', key: 'status' },
  { title: 'Started', dataIndex: 'startTime', key: 'startTime' },
  { title: 'Action', key: 'action', width: 100 }
]

async function load() {
  loading.value = true
  try {
    const page = await listOpsInstances()
    instances.value = page.items
  } finally {
    loading.value = false
  }
}

async function inspect(instanceId: string) {
  detail.value = await getOpsInstance(instanceId)
}

onMounted(load)
</script>
