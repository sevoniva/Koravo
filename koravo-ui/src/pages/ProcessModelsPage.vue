<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>Process Models</h1>
        <p>Manage BPMN drafts, deployments, disabled models, and archived models.</p>
      </div>
      <a-space>
        <a-button :loading="loadingModels" @click="loadModels"><ReloadOutlined />Reload</a-button>
        <a-button type="primary" @click="router.push('/process-designer')"><EditOutlined />Open Designer</a-button>
      </a-space>
    </div>

    <a-form layout="vertical" class="form-grid">
      <a-form-item label="Model name">
        <a-input v-model:value="modelName" placeholder="Leave Approval" />
      </a-form-item>
      <a-form-item label="BPMN file">
        <a-upload :before-upload="beforeUpload" :max-count="1" accept=".xml,.bpmn,.bpmn20.xml">
          <a-button><UploadOutlined />Select BPMN</a-button>
        </a-upload>
      </a-form-item>
      <a-form-item>
        <a-button type="primary" :disabled="!file" :loading="loading" @click="deploy"><UploadOutlined />Deploy</a-button>
      </a-form-item>
    </a-form>

    <JsonPreview :value="deployment" />

    <a-form layout="vertical" class="form-grid panel-block">
      <a-form-item label="Status">
        <a-select v-model:value="statusFilter" allow-clear @change="loadModels">
          <a-select-option value="DRAFT">DRAFT</a-select-option>
          <a-select-option value="DEPLOYED">DEPLOYED</a-select-option>
          <a-select-option value="DISABLED">DISABLED</a-select-option>
          <a-select-option value="ARCHIVED">ARCHIVED</a-select-option>
        </a-select>
      </a-form-item>
    </a-form>

    <a-table :data-source="models" :columns="columns" row-key="id" :pagination="false" class="panel-block">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-space wrap>
            <a-button size="small" @click="inspect(record.id)">Detail</a-button>
            <a-button size="small" @click="router.push(`/process-designer?modelId=${record.id}`)">Edit</a-button>
            <a-button size="small" @click="exportModel(record)">Export</a-button>
            <a-button
              size="small"
              type="primary"
              :disabled="record.status !== 'DRAFT'"
              :loading="actionLoading === `deploy:${record.id}`"
              @click="deployDraft(record.id)"
            >
              Deploy
            </a-button>
            <a-button
              v-if="record.status !== 'DISABLED' && record.status !== 'ARCHIVED'"
              size="small"
              :loading="actionLoading === `disable:${record.id}`"
              @click="disableModel(record.id)"
            >
              Disable
            </a-button>
            <a-popconfirm
              v-if="record.status !== 'ARCHIVED'"
              title="Archive this process model?"
              ok-text="Archive"
              cancel-text="Cancel"
              @confirm="archiveModel(record.id)"
            >
              <a-button size="small" danger :loading="actionLoading === `archive:${record.id}`">Archive</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <JsonPreview :value="selectedModel" />
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { EditOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons-vue'
import JsonPreview from '../components/JsonPreview.vue'
import {
  archiveProcessModel,
  deployProcessModel,
  deployProcessModelDraft,
  disableProcessModel,
  exportProcessModel,
  getProcessModel,
  listProcessModels,
  type ProcessDeployment,
  type ProcessModelItem
} from '../api/koravo'

const modelName = ref('Leave Approval')
const router = useRouter()
const file = ref<File | null>(null)
const loading = ref(false)
const loadingModels = ref(false)
const actionLoading = ref<string | null>(null)
const deployment = ref<ProcessDeployment | null>(null)
const models = ref<ProcessModelItem[]>([])
const selectedModel = ref<ProcessModelItem | null>(null)
const statusFilter = ref<string | undefined>()

const columns = [
  { title: 'Name', dataIndex: 'modelName', key: 'modelName' },
  { title: 'Key', dataIndex: 'modelKey', key: 'modelKey' },
  { title: 'Version', dataIndex: 'version', key: 'version', width: 90 },
  { title: 'Status', dataIndex: 'status', key: 'status', width: 120 },
  { title: 'Definition', dataIndex: 'flowableDefinitionId', key: 'flowableDefinitionId' },
  { title: 'Updated', dataIndex: 'updatedAt', key: 'updatedAt', width: 210 },
  { title: 'Action', key: 'action', width: 430 }
]

function beforeUpload(nextFile: File) {
  file.value = nextFile
  return false
}

async function deploy() {
  if (!file.value) {
    message.warning('Select a BPMN file first')
    return
  }
  loading.value = true
  try {
    deployment.value = await deployProcessModel(modelName.value, file.value)
    message.success('Process deployed')
    await loadModels()
  } finally {
    loading.value = false
  }
}

async function loadModels() {
  loadingModels.value = true
  try {
    models.value = await listProcessModels(statusFilter.value)
  } finally {
    loadingModels.value = false
  }
}

async function inspect(id: string) {
  selectedModel.value = await getProcessModel(id)
}

async function deployDraft(id: string) {
  await runAction(`deploy:${id}`, async () => {
    await deployProcessModelDraft(id)
    message.success('Model deployed')
  })
}

async function disableModel(id: string) {
  await runAction(`disable:${id}`, async () => {
    selectedModel.value = await disableProcessModel(id)
    message.success('Model disabled')
  })
}

async function archiveModel(id: string) {
  await runAction(`archive:${id}`, async () => {
    selectedModel.value = await archiveProcessModel(id)
    message.success('Model archived')
  })
}

async function exportModel(model: ProcessModelItem) {
  const blob = await exportProcessModel(model.id)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${model.modelKey}.bpmn20.xml`
  link.click()
  URL.revokeObjectURL(url)
}

async function runAction(key: string, action: () => Promise<void>) {
  actionLoading.value = key
  try {
    await action()
    await loadModels()
  } finally {
    actionLoading.value = null
  }
}

onMounted(loadModels)
</script>
