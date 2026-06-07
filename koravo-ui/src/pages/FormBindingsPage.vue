<template>
  <PageContainer>
    <PageHeader title="表单绑定" description="为已部署流程的任务节点选择表单版本。">
      <template #actions>
        <a-button :loading="loading" @click="load"><ReloadOutlined />刷新</a-button>
      </template>
    </PageHeader>

    <DetailSection title="绑定配置">
      <a-form layout="vertical" class="form-grid">
        <a-form-item label="已部署模型" required>
          <a-select
            v-model:value="selectedModelId"
            allow-clear
            :loading="loading"
            placeholder="请选择模型"
            @change="handleModelChange"
          >
            <a-select-option v-for="model in processModels" :key="model.id" :value="model.id">
              {{ modelLabel(model.id) }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="模型状态">
          <StatusTag v-if="selectedModel" :status="selectedModel.status" />
          <span v-else>-</span>
        </a-form-item>
        <a-form-item label="流程模型">
          <CopyableText :value="form.processModelId" :display-value="selectedModelLabel" />
        </a-form-item>
        <a-form-item label="流程定义">
          <CopyableText :value="form.processDefinitionId" :display-value="definitionLabel(form.processDefinitionId)" />
        </a-form-item>
        <a-form-item label="任务节点" required>
          <a-select
            v-model:value="form.taskDefinitionKey"
            :disabled="!selectedModelId || !taskDefinitions.length"
            :loading="taskLoading"
            placeholder="请选择任务节点"
          >
            <a-select-option v-for="task in taskDefinitions" :key="task.taskDefinitionKey" :value="task.taskDefinitionKey">
              {{ taskLabel(task.taskDefinitionKey) }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="表单" required>
          <a-select v-model:value="selectedFormId" placeholder="请选择表单" @change="syncSelectedForm">
            <a-select-option v-for="schema in schemas" :key="schema.id" :value="schema.id">
              {{ schema.formName }} v{{ schema.version }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item class="span-2">
          <Toolbar>
            <a-button type="primary" :disabled="!canSave" :loading="saving" @click="save">
              <SaveOutlined />{{ editingId ? '更新绑定' : '保存绑定' }}
            </a-button>
            <a-button v-if="editingId" @click="cancelEdit">取消编辑</a-button>
            <a-button @click="clearSelection">清空选择</a-button>
          </Toolbar>
        </a-form-item>
      </a-form>
    </DetailSection>

    <DetailSection title="当前绑定">
      <a-table :data-source="bindings" :columns="columns" row-key="id" :loading="loading" :pagination="false" size="small">
        <template #emptyText>
          <EmptyState description="暂无表单绑定" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'processModelId'">
            {{ modelLabel(record.processModelId) }}
          </template>
          <template v-else-if="column.key === 'processDefinitionId'">
            <CopyableText :value="record.processDefinitionId" :display-value="definitionLabel(record.processDefinitionId)" />
          </template>
          <template v-else-if="column.key === 'taskDefinitionKey'">
            {{ taskLabel(record.taskDefinitionKey) }}
          </template>
          <template v-else-if="column.key === 'formSchemaId'">
            {{ schemaLabel(record.formSchemaId, record.formSchemaVersion) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button size="small" @click="edit(record)">编辑</a-button>
              <ConfirmAction title="确认删除该表单绑定？" ok-text="删除" @confirm="remove(record.id)">
                <a-button size="small" danger>删除</a-button>
              </ConfirmAction>
            </a-space>
          </template>
        </template>
      </a-table>
    </DetailSection>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons-vue'
import { ConfirmAction, CopyableText, DetailSection, EmptyState, PageContainer, PageHeader, StatusTag, Toolbar } from '../components/ui'
import {
  createFormBinding,
  deleteFormBinding,
  listFormBindings,
  listProcessModels,
  listFormSchemas,
  listProcessModelTaskDefinitions,
  updateFormBinding,
  type BpmnTaskDefinition,
  type FormBindingItem,
  type FormSchemaItem,
  type ProcessModelItem
} from '../api/koravo'
import { processDefinitionLabel, processDisplayName, taskDefinitionLabel } from '../utils/display'

const loading = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const bindings = ref<FormBindingItem[]>([])
const schemas = ref<FormSchemaItem[]>([])
const processModels = ref<ProcessModelItem[]>([])
const taskDefinitions = ref<BpmnTaskDefinition[]>([])
const selectedFormId = ref<string>()
const selectedModelId = ref<string>()
const taskLoading = ref(false)
const form = reactive({
  processModelId: '',
  processDefinitionId: '',
  taskDefinitionKey: '',
  formSchemaId: '',
  formSchemaVersion: 1
})

const columns = [
  { title: '流程模型', dataIndex: 'processModelId', key: 'processModelId', width: 220 },
  { title: '流程定义', dataIndex: 'processDefinitionId', key: 'processDefinitionId', width: 260 },
  { title: '任务节点', dataIndex: 'taskDefinitionKey', key: 'taskDefinitionKey', width: 180 },
  { title: '表单', dataIndex: 'formSchemaId', key: 'formSchemaId', width: 220 },
  { title: '版本', dataIndex: 'formSchemaVersion', key: 'formSchemaVersion', width: 90 },
  { title: '操作', key: 'action', width: 150 }
]

const selectedModel = computed(() => processModels.value.find((item) => item.id === selectedModelId.value))
const selectedModelLabel = computed(() => selectedModel.value ? modelLabel(selectedModel.value.id) : '')
const canSave = computed(() => Boolean(form.processModelId && form.taskDefinitionKey && form.formSchemaId))

async function load() {
  loading.value = true
  try {
    const [nextBindings, nextSchemas, nextProcessModels] = await Promise.all([
      listFormBindings(),
      listFormSchemas(),
      listProcessModels('DEPLOYED')
    ])
    schemas.value = nextSchemas
    processModels.value = nextProcessModels
    ensureSelectedForm()

    const model = selectedModel.value || findModelForBinding(nextBindings[0]) || nextProcessModels[0]
    if (model) {
      selectedModelId.value = model.id
      syncModelFields(model)
      await Promise.all([
        loadTaskDefinitions(model.id),
        refreshBindings(model)
      ])
    } else {
      clearModelFields()
      bindings.value = nextBindings
    }
  } finally {
    loading.value = false
  }
}

async function handleModelChange() {
  editingId.value = null
  const model = selectedModel.value
  loading.value = true
  try {
    if (!model) {
      clearModelFields()
      bindings.value = await listFormBindings()
      return
    }
    syncModelFields(model)
    await Promise.all([
      loadTaskDefinitions(model.id),
      refreshBindings(model)
    ])
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!form.processModelId) {
    message.warning('请先选择已部署模型')
    return
  }
  if (!form.taskDefinitionKey) {
    message.warning('请先选择任务节点')
    return
  }
  if (!form.formSchemaId) {
    message.warning('请先选择表单')
    return
  }

  saving.value = true
  try {
    const payload = {
      processModelId: form.processModelId,
      processDefinitionId: form.processDefinitionId || undefined,
      taskDefinitionKey: form.taskDefinitionKey,
      formSchemaId: form.formSchemaId,
      formSchemaVersion: form.formSchemaVersion
    }
    if (editingId.value) {
      await updateFormBinding(editingId.value, payload)
    } else {
      await createFormBinding(payload)
    }
    message.success(editingId.value ? '表单绑定已更新' : '表单绑定已保存')
    editingId.value = null
    await refreshBindings(selectedModel.value)
  } finally {
    saving.value = false
  }
}

async function edit(record: FormBindingItem) {
  editingId.value = record.id
  selectedModelId.value = record.processModelId
  const model = selectedModel.value
  if (model) {
    syncModelFields(model)
    await loadTaskDefinitions(model.id)
  } else {
    form.processModelId = record.processModelId || ''
    form.processDefinitionId = record.processDefinitionId || ''
  }
  form.taskDefinitionKey = record.taskDefinitionKey
  form.formSchemaId = record.formSchemaId
  form.formSchemaVersion = record.formSchemaVersion
  selectedFormId.value = record.formSchemaId
}

async function remove(id: string) {
  await deleteFormBinding(id)
  if (editingId.value === id) cancelEdit()
  message.success('表单绑定已删除')
  await refreshBindings(selectedModel.value)
}

function cancelEdit() {
  editingId.value = null
}

async function clearSelection() {
  editingId.value = null
  selectedModelId.value = undefined
  clearModelFields()
  ensureSelectedForm()
  loading.value = true
  try {
    bindings.value = await listFormBindings()
  } finally {
    loading.value = false
  }
}

async function refreshBindings(model?: ProcessModelItem) {
  bindings.value = await listFormBindings(model ? {
    processModelId: model.id,
    processDefinitionId: model.flowableDefinitionId || undefined
  } : undefined)
}

async function loadTaskDefinitions(modelId: string) {
  taskLoading.value = true
  try {
    taskDefinitions.value = await listProcessModelTaskDefinitions(modelId)
    if (!taskDefinitions.value.some((item) => item.taskDefinitionKey === form.taskDefinitionKey)) {
      form.taskDefinitionKey = taskDefinitions.value[0]?.taskDefinitionKey || ''
    }
  } finally {
    taskLoading.value = false
  }
}

function syncModelFields(model: ProcessModelItem) {
  form.processModelId = model.id
  form.processDefinitionId = model.flowableDefinitionId || ''
}

function clearModelFields() {
  form.processModelId = ''
  form.processDefinitionId = ''
  form.taskDefinitionKey = ''
  taskDefinitions.value = []
}

function ensureSelectedForm() {
  if (!schemas.value.some((item) => item.id === selectedFormId.value)) {
    selectedFormId.value = schemas.value[0]?.id
  }
  syncSelectedForm()
}

function syncSelectedForm() {
  const schema = schemas.value.find((item) => item.id === selectedFormId.value)
  if (!schema) {
    form.formSchemaId = ''
    form.formSchemaVersion = 1
    return
  }
  form.formSchemaId = schema.id
  form.formSchemaVersion = schema.version
}

function modelLabel(id?: string) {
  const model = processModels.value.find((item) => item.id === id)
  if (!model) return id || '-'
  return `${processDisplayName(model.modelKey, model.modelName)} v${model.version}`
}

function findModelForBinding(binding?: FormBindingItem) {
  if (!binding) return undefined
  return processModels.value.find((item) =>
    item.id === binding.processModelId || item.flowableDefinitionId === binding.processDefinitionId
  )
}

function schemaLabel(id?: string, version?: number) {
  const schema = schemas.value.find((item) => item.id === id)
  if (!schema) return id ? `${id} v${version || '-'}` : '-'
  return `${schema.formName} v${version || schema.version}`
}

function taskLabel(key?: string) {
  if (!key) return '-'
  const task = taskDefinitions.value.find((item) => item.taskDefinitionKey === key)
  return taskDefinitionLabel(key, task)
}

function definitionLabel(value?: string) {
  return processDefinitionLabel(value) || '-'
}

onMounted(load)
</script>
