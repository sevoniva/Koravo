<template>
  <PageContainer wide>
    <PageHeader title="流程模型" description="管理流程草稿、部署版本和模型状态。">
      <template #actions>
        <a-button :loading="loadingModels" @click="loadModels"><ReloadOutlined />刷新</a-button>
        <a-button type="primary" @click="router.push('/process-designer')"><EditOutlined />打开设计器</a-button>
      </template>
    </PageHeader>

    <a-form layout="vertical" class="form-grid">
      <a-form-item label="模型名称">
        <a-input v-model:value="modelName" placeholder="请假审批流程" />
      </a-form-item>
      <a-form-item label="BPMN 文件">
        <a-upload :before-upload="beforeUpload" :max-count="1" accept=".xml,.bpmn,.bpmn20.xml">
          <a-button><UploadOutlined />选择 BPMN</a-button>
        </a-upload>
      </a-form-item>
      <a-form-item>
        <a-button type="primary" :disabled="!file" :loading="loading" @click="deploy"><UploadOutlined />部署</a-button>
      </a-form-item>
    </a-form>

    <DetailSection v-if="deployment" title="部署结果">
      <a-descriptions bordered :column="2" size="small">
        <a-descriptions-item label="模型">{{ deployment.platformModelId }}</a-descriptions-item>
        <a-descriptions-item label="流程 Key">{{ deployment.processDefinitionKey }}</a-descriptions-item>
        <a-descriptions-item label="版本">{{ deployment.version }}</a-descriptions-item>
        <a-descriptions-item label="部署 ID">{{ deployment.deploymentId }}</a-descriptions-item>
        <a-descriptions-item label="流程定义" :span="2">{{ deployment.processDefinitionId }}</a-descriptions-item>
      </a-descriptions>
    </DetailSection>

    <a-form layout="vertical" class="form-grid panel-block">
      <a-form-item label="状态">
        <a-select v-model:value="statusFilter" allow-clear @change="loadModels">
          <a-select-option value="DRAFT">草稿</a-select-option>
          <a-select-option value="DEPLOYED">已部署</a-select-option>
          <a-select-option value="DISABLED">已禁用</a-select-option>
          <a-select-option value="ARCHIVED">已归档</a-select-option>
        </a-select>
      </a-form-item>
    </a-form>

    <a-table
      :data-source="models"
      :columns="columns"
      row-key="id"
      :loading="loadingModels"
      :pagination="false"
      class="panel-block"
      size="small"
      :scroll="{ x: 1080 }"
    >
      <template #emptyText>
        <EmptyState description="暂无流程模型" />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <StatusTag :status="record.status" />
        </template>
        <template v-else-if="column.key === 'updatedAt'">
          {{ formatDateTime(record.updatedAt) }}
        </template>
        <template v-if="column.key === 'action'">
          <Toolbar>
            <a-button size="small" @click="inspect(record.id)">详情</a-button>
            <a-button size="small" @click="router.push(`/process-designer?modelId=${record.id}`)">编辑</a-button>
            <a-button size="small" :loading="actionLoading === `validate:${record.id}`" @click="validateModel(record.id)">校验</a-button>
            <a-button size="small" @click="exportModel(record)">导出</a-button>
            <a-button
              size="small"
              type="primary"
              :disabled="record.status !== 'DRAFT'"
              :loading="actionLoading === `deploy:${record.id}`"
              @click="deployDraft(record.id)"
            >
              部署
            </a-button>
            <a-button
              v-if="record.status !== 'DISABLED' && record.status !== 'ARCHIVED'"
              size="small"
              :loading="actionLoading === `disable:${record.id}`"
              @click="disableModel(record.id)"
            >
              禁用
            </a-button>
            <a-popconfirm
              v-if="record.status !== 'ARCHIVED'"
              title="确认归档该流程模型？"
              ok-text="归档"
              cancel-text="取消"
              @confirm="archiveModel(record.id)"
            >
              <a-button size="small" danger :loading="actionLoading === `archive:${record.id}`">归档</a-button>
            </a-popconfirm>
          </Toolbar>
        </template>
      </template>
    </a-table>

    <DetailSection v-if="selectedModel" title="模型详情">
      <a-descriptions bordered :column="2" size="small">
        <a-descriptions-item label="模型名称">{{ selectedModel.modelName }}</a-descriptions-item>
        <a-descriptions-item label="状态"><StatusTag :status="selectedModel.status" /></a-descriptions-item>
        <a-descriptions-item label="模型 Key">{{ selectedModel.modelKey }}</a-descriptions-item>
        <a-descriptions-item label="版本">{{ selectedModel.version }}</a-descriptions-item>
        <a-descriptions-item label="流程定义">{{ selectedModel.flowableDefinitionId || '-' }}</a-descriptions-item>
        <a-descriptions-item label="部署 ID">{{ selectedModel.flowableDeploymentId || '-' }}</a-descriptions-item>
        <a-descriptions-item label="更新时间">{{ formatDateTime(selectedModel.updatedAt) }}</a-descriptions-item>
        <a-descriptions-item label="说明">{{ selectedModel.description || '-' }}</a-descriptions-item>
      </a-descriptions>
    </DetailSection>

    <DetailSection v-if="validation" title="校验结果">
      <a-alert
        :type="validation.valid ? 'success' : 'error'"
        :message="validation.valid ? '校验通过' : '校验未通过'"
        show-icon
      />
      <a-table
        class="panel-block"
        :data-source="validationIssues"
        :columns="validationColumns"
        row-key="key"
        :pagination="false"
        size="small"
      >
        <template #emptyText>
          <EmptyState description="暂无校验问题" />
        </template>
      </a-table>
    </DetailSection>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { EditOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons-vue'
import { DetailSection, EmptyState, PageContainer, PageHeader, StatusTag, Toolbar } from '../components/ui'
import {
  archiveProcessModel,
  deployProcessModel,
  deployProcessModelDraft,
  disableProcessModel,
  exportProcessModel,
  getProcessModel,
  listProcessModels,
  validateProcessModel,
  type BpmnValidationResult,
  type ProcessDeployment,
  type ProcessModelItem
} from '../api/koravo'
import { formatDateTime } from '../utils/format'

const modelName = ref('请假审批流程')
const router = useRouter()
const file = ref<File | null>(null)
const loading = ref(false)
const loadingModels = ref(false)
const actionLoading = ref<string | null>(null)
const deployment = ref<ProcessDeployment | null>(null)
const models = ref<ProcessModelItem[]>([])
const selectedModel = ref<ProcessModelItem | null>(null)
const validation = ref<BpmnValidationResult | null>(null)
const statusFilter = ref<string | undefined>()

const columns = [
  { title: '模型名称', dataIndex: 'modelName', key: 'modelName', width: 220 },
  { title: '模型 Key', dataIndex: 'modelKey', key: 'modelKey', width: 180 },
  { title: '版本', dataIndex: 'version', key: 'version', width: 90 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
  { title: '流程定义', dataIndex: 'flowableDefinitionId', key: 'flowableDefinitionId', width: 240 },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 170 },
  { title: '操作', key: 'action', width: 520 }
]

const validationColumns = [
  { title: '类型', dataIndex: 'type', key: 'type', width: 90 },
  { title: '节点', dataIndex: 'elementId', key: 'elementId', width: 160 },
  { title: '编码', dataIndex: 'code', key: 'code', width: 160 },
  { title: '说明', dataIndex: 'message', key: 'message' }
]

const validationIssues = computed(() => [
  ...(validation.value?.errors || []).map((item, index) => ({ ...item, key: `error:${index}`, type: '错误' })),
  ...(validation.value?.warnings || []).map((item, index) => ({ ...item, key: `warning:${index}`, type: '警告' }))
])

function beforeUpload(nextFile: File) {
  file.value = nextFile
  return false
}

async function deploy() {
  if (!file.value) {
    message.warning('请先选择 BPMN 文件')
    return
  }
  loading.value = true
  try {
    deployment.value = await deployProcessModel(modelName.value, file.value)
    message.success('流程部署成功')
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

async function validateModel(id: string) {
  await runAction(`validate:${id}`, async () => {
    validation.value = await validateProcessModel(id)
    const errorCount = validation.value.errors.length
    const warningCount = validation.value.warnings.length
    if (validation.value.valid) {
      message.success(`BPMN 校验通过，${warningCount} 个警告`)
    } else {
      message.error(`BPMN 校验失败，${errorCount} 个错误`)
    }
  }, false)
}

async function deployDraft(id: string) {
  await runAction(`deploy:${id}`, async () => {
    await deployProcessModelDraft(id)
    message.success('模型部署成功')
  })
}

async function disableModel(id: string) {
  await runAction(`disable:${id}`, async () => {
    selectedModel.value = await disableProcessModel(id)
    message.success('模型已禁用')
  })
}

async function archiveModel(id: string) {
  await runAction(`archive:${id}`, async () => {
    selectedModel.value = await archiveProcessModel(id)
    message.success('模型已归档')
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

async function runAction(key: string, action: () => Promise<void>, reload = true) {
  actionLoading.value = key
  try {
    await action()
    if (reload) await loadModels()
  } finally {
    actionLoading.value = null
  }
}

onMounted(loadModels)
</script>
