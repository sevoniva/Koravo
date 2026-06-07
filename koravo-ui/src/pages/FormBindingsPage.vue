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
        <a-button type="primary" :loading="saving" @click="bind"><LinkOutlined />Bind</a-button>
      </a-form-item>
    </a-form>

    <a-table :data-source="bindings" :columns="columns" row-key="id" :pagination="false" />
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { LinkOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import {
  createFormBinding,
  listFormBindings,
  listFormSchemas,
  type FormBindingItem,
  type FormSchemaItem
} from '../api/koravo'

const loading = ref(false)
const saving = ref(false)
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
  { title: 'Version', dataIndex: 'formSchemaVersion', key: 'formSchemaVersion', width: 100 }
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

async function bind() {
  if (!form.formSchemaId) {
    message.warning('Select a form schema first')
    return
  }
  saving.value = true
  try {
    await createFormBinding({
      processModelId: form.processModelId || undefined,
      processDefinitionId: form.processDefinitionId || undefined,
      taskDefinitionKey: form.taskDefinitionKey,
      formSchemaId: form.formSchemaId,
      formSchemaVersion: form.formSchemaVersion
    })
    message.success('Form binding saved')
    await load()
  } finally {
    saving.value = false
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
