<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>Forms</h1>
        <p>Create and version JSON form schemas for task pages.</p>
      </div>
      <a-button :loading="loading" @click="load"><ReloadOutlined />Reload</a-button>
    </div>

    <a-form layout="vertical" class="form-grid">
      <a-form-item label="Form key"><a-input v-model:value="form.formKey" /></a-form-item>
      <a-form-item label="Form name"><a-input v-model:value="form.formName" /></a-form-item>
      <a-form-item label="Schema JSON" class="span-2">
        <a-textarea v-model:value="form.schemaJson" :rows="8" />
      </a-form-item>
      <a-form-item label="UI schema JSON" class="span-2">
        <a-textarea v-model:value="form.uiSchemaJson" :rows="4" />
      </a-form-item>
      <a-form-item>
        <a-button type="primary" :loading="saving" @click="save"><SaveOutlined />{{ editingId ? 'Update' : 'Create' }}</a-button>
      </a-form-item>
      <a-form-item>
        <a-button @click="reset">Reset</a-button>
      </a-form-item>
    </a-form>

    <a-table :data-source="items" :columns="columns" row-key="id" :loading="loading" :pagination="false">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button size="small" @click="edit(record)">Edit</a-button>
            <a-button size="small" @click="preview(record)">Preview</a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <JsonPreview :value="selected" />
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons-vue'
import JsonPreview from '../components/JsonPreview.vue'
import {
  createFormSchema,
  getFormSchema,
  listFormSchemas,
  updateFormSchema,
  type FormSchemaItem
} from '../api/koravo'
import { JsonInputError, parseJsonObject } from '../utils/jsonInput'

const loading = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const items = ref<FormSchemaItem[]>([])
const selected = ref<FormSchemaItem | null>(null)
const form = reactive({
  formKey: 'leave',
  formName: 'Leave Approval',
  schemaJson: JSON.stringify({
    type: 'object',
    required: ['days', 'reason'],
    properties: {
      days: { type: 'number', title: 'Days' },
      reason: { type: 'string', title: 'Reason' }
    }
  }, null, 2),
  uiSchemaJson: '{}'
})

const columns = [
  { title: 'Key', dataIndex: 'formKey', key: 'formKey' },
  { title: 'Name', dataIndex: 'formName', key: 'formName' },
  { title: 'Version', dataIndex: 'version', key: 'version', width: 100 },
  { title: 'Status', dataIndex: 'status', key: 'status', width: 110 },
  { title: 'Action', key: 'action', width: 160 }
]

async function load() {
  loading.value = true
  try {
    items.value = await listFormSchemas()
  } finally {
    loading.value = false
  }
}

async function save() {
  try {
    parseJsonObject(form.schemaJson, 'Schema JSON')
    if (form.uiSchemaJson) parseJsonObject(form.uiSchemaJson, 'UI schema JSON')
  } catch (error) {
    if (error instanceof JsonInputError) {
      message.error(error.message)
    }
    return
  }
  saving.value = true
  try {
    const payload = { ...form }
    const saved = editingId.value
      ? await updateFormSchema(editingId.value, payload)
      : await createFormSchema(payload)
    selected.value = saved
    message.success(editingId.value ? 'Form updated' : 'Form created')
    reset()
    await load()
  } finally {
    saving.value = false
  }
}

function edit(record: FormSchemaItem) {
  editingId.value = record.id
  form.formKey = record.formKey
  form.formName = record.formName
  form.schemaJson = record.schemaJson
  form.uiSchemaJson = record.uiSchemaJson || '{}'
  selected.value = record
}

async function preview(record: FormSchemaItem) {
  selected.value = await getFormSchema(record.id)
}

function reset() {
  editingId.value = null
}

onMounted(load)
</script>
