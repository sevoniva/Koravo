<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>Form Bindings</h1>
        <p>Bind task definition keys to versioned form schemas.</p>
      </div>
      <a-button :loading="loading" @click="load"><ReloadOutlined />Reload</a-button>
    </div>

    <a-form layout="vertical" class="form-grid">
      <a-form-item label="Process model ID"><a-input v-model:value="form.processModelId" /></a-form-item>
      <a-form-item label="Process definition ID"><a-input v-model:value="form.processDefinitionId" /></a-form-item>
      <a-form-item label="Task definition key"><a-input v-model:value="form.taskDefinitionKey" /></a-form-item>
      <a-form-item label="Form schema">
        <a-select v-model:value="selectedFormId" @change="syncSelectedForm">
          <a-select-option v-for="schema in schemas" :key="schema.id" :value="schema.id">
            {{ schema.formName }} v{{ schema.version }}
          </a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item>
        <a-space>
          <a-button type="primary" :loading="saving" @click="save">
            <SaveOutlined />{{ editingId ? 'Update' : 'Bind' }}
          </a-button>
          <a-button v-if="editingId" @click="reset">Cancel</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-table :data-source="bindings" :columns="columns" row-key="id" :pagination="false">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button size="small" @click="edit(record)">Edit</a-button>
            <a-popconfirm title="Delete this binding?" @confirm="remove(record.id)">
              <a-button size="small" danger>Delete</a-button>
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
  listFormSchemas,
  updateFormBinding,
  type FormBindingItem,
  type FormSchemaItem
} from '../api/koravo'

const loading = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const bindings = ref<FormBindingItem[]>([])
const schemas = ref<FormSchemaItem[]>([])
const selectedFormId = ref<string>()
const form = reactive({
  processModelId: '',
  processDefinitionId: '',
  taskDefinitionKey: 'approveTask',
  formSchemaId: '',
  formSchemaVersion: 1
})

const columns = [
  { title: 'Task Key', dataIndex: 'taskDefinitionKey', key: 'taskDefinitionKey' },
  { title: 'Process Model', dataIndex: 'processModelId', key: 'processModelId' },
  { title: 'Process Definition', dataIndex: 'processDefinitionId', key: 'processDefinitionId' },
  { title: 'Form Schema', dataIndex: 'formSchemaId', key: 'formSchemaId' },
  { title: 'Version', dataIndex: 'formSchemaVersion', key: 'formSchemaVersion', width: 100 },
  { title: 'Action', key: 'action', width: 170 }
]

async function load() {
  loading.value = true
  try {
    const [nextBindings, nextSchemas] = await Promise.all([listFormBindings(), listFormSchemas()])
    bindings.value = nextBindings
    schemas.value = nextSchemas
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
    message.warning('Select a form schema first')
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
    message.success(editingId.value ? 'Form binding updated' : 'Form binding saved')
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
}

async function remove(id: string) {
  await deleteFormBinding(id)
  if (editingId.value === id) reset()
  message.success('Form binding deleted')
  await load()
}

function reset() {
  editingId.value = null
  form.processModelId = ''
  form.processDefinitionId = ''
  form.taskDefinitionKey = 'approveTask'
  if (selectedFormId.value) {
    syncSelectedForm()
  } else {
    form.formSchemaId = ''
    form.formSchemaVersion = 1
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
