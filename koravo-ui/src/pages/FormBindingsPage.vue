<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>表单绑定</h1>
        <p>把任务节点绑定到指定版本的表单。</p>
      </div>
      <a-button :loading="loading" @click="load"><ReloadOutlined />刷新</a-button>
    </div>

    <a-form layout="vertical" class="form-grid">
      <a-form-item label="已部署模型">
        <a-select
          v-model:value="selectedModelId"
          allow-clear
          :loading="loading"
          placeholder="请选择已部署模型"
          @change="syncSelectedModel"
        >
          <a-select-option v-for="model in processModels" :key="model.id" :value="model.id">
            {{ model.modelName }} / {{ model.modelKey }} v{{ model.version }}
          </a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item>
        <a-button :disabled="!selectedModelId" :loading="taskLoading" @click="loadSelectedModelBindings">加载绑定</a-button>
      </a-form-item>
      <a-form-item label="流程模型 ID"><a-input v-model:value="form.processModelId" disabled /></a-form-item>
      <a-form-item label="流程定义 ID"><a-input v-model:value="form.processDefinitionId" disabled /></a-form-item>
      <a-form-item label="任务节点">
        <a-select
          v-model:value="form.taskDefinitionKey"
          :loading="taskLoading"
          placeholder="请选择任务节点"
        >
          <a-select-option v-for="task in taskDefinitions" :key="task.taskDefinitionKey" :value="task.taskDefinitionKey">
            {{ task.name || task.taskDefinitionKey }} / {{ task.taskDefinitionKey }}
          </a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="表单">
        <a-select v-model:value="selectedFormId" @change="syncSelectedForm">
          <a-select-option v-for="schema in schemas" :key="schema.id" :value="schema.id">
            {{ schema.formName }} v{{ schema.version }}
          </a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item>
        <a-space>
          <a-button type="primary" :loading="saving" @click="save">
            <SaveOutlined />{{ editingId ? '更新' : '绑定' }}
          </a-button>
          <a-button v-if="editingId" @click="reset">取消</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-table :data-source="bindings" :columns="columns" row-key="id" :pagination="false">
      <template #emptyText>
        <a-empty description="暂无表单绑定" />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button size="small" @click="edit(record)">编辑</a-button>
            <a-popconfirm title="确认删除该表单绑定？" ok-text="删除" cancel-text="取消" @confirm="remove(record.id)">
              <a-button size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons-vue'
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
  type ProcessModelItem,
  type FormSchemaItem
} from '../api/koravo'

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
  taskDefinitionKey: 'approveTask',
  formSchemaId: '',
  formSchemaVersion: 1
})

const columns = [
  { title: '任务节点 Key', dataIndex: 'taskDefinitionKey', key: 'taskDefinitionKey' },
  { title: '流程模型', dataIndex: 'processModelId', key: 'processModelId' },
  { title: '流程定义', dataIndex: 'processDefinitionId', key: 'processDefinitionId' },
  { title: '表单', dataIndex: 'formSchemaId', key: 'formSchemaId' },
  { title: '版本', dataIndex: 'formSchemaVersion', key: 'formSchemaVersion', width: 100 },
  { title: '操作', key: 'action', width: 170 }
]

async function load() {
  loading.value = true
  try {
    const [nextBindings, nextSchemas, nextProcessModels] = await Promise.all([
      listFormBindings(),
      listFormSchemas(),
      listProcessModels('DEPLOYED')
    ])
    bindings.value = nextBindings
    schemas.value = nextSchemas
    processModels.value = nextProcessModels
    if (!selectedFormId.value && nextSchemas[0]) {
      selectedFormId.value = nextSchemas[0].id
      syncSelectedForm()
    }
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!form.formSchemaId) {
    message.warning('请先选择表单')
    return
  }
  saving.value = true
  try {
    const payload = {
      processModelId: form.processModelId || undefined,
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
    reset()
    await load()
  } finally {
    saving.value = false
  }
}

function edit(record: FormBindingItem) {
  editingId.value = record.id
  form.processModelId = record.processModelId || ''
  form.processDefinitionId = record.processDefinitionId || ''
  form.taskDefinitionKey = record.taskDefinitionKey
  form.formSchemaId = record.formSchemaId
  form.formSchemaVersion = record.formSchemaVersion
  selectedFormId.value = record.formSchemaId
  selectedModelId.value = record.processModelId
  if (selectedModelId.value) {
    void loadTaskDefinitions(selectedModelId.value)
  }
}

async function remove(id: string) {
  await deleteFormBinding(id)
  if (editingId.value === id) reset()
  message.success('表单绑定已删除')
  await load()
}

function reset() {
  editingId.value = null
  form.processModelId = ''
  form.processDefinitionId = ''
  selectedModelId.value = undefined
  form.taskDefinitionKey = 'approveTask'
  if (selectedFormId.value) {
    syncSelectedForm()
  } else {
    form.formSchemaId = ''
    form.formSchemaVersion = 1
  }
}

async function syncSelectedModel() {
  const model = processModels.value.find((item) => item.id === selectedModelId.value)
  if (!model) return
  form.processModelId = model.id
  form.processDefinitionId = model.flowableDefinitionId || ''
  await loadTaskDefinitions(model.id)
}

async function loadSelectedModelBindings() {
  const model = processModels.value.find((item) => item.id === selectedModelId.value)
  if (!model) return
  await syncSelectedModel()
  loading.value = true
  try {
    bindings.value = await listFormBindings({
      processModelId: model.id,
      processDefinitionId: model.flowableDefinitionId || undefined
    })
  } finally {
    loading.value = false
  }
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

function syncSelectedForm() {
  const schema = schemas.value.find((item) => item.id === selectedFormId.value)
  if (!schema) return
  form.formSchemaId = schema.id
  form.formSchemaVersion = schema.version
}

onMounted(load)
</script>
