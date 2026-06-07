<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>表单管理</h1>
        <p>创建和维护任务页面使用的 JSON Schema 表单。</p>
      </div>
      <a-button :loading="loading" @click="load"><ReloadOutlined />刷新</a-button>
    </div>

    <a-form layout="vertical" class="form-grid">
      <a-form-item label="表单 Key"><a-input v-model:value="form.formKey" /></a-form-item>
      <a-form-item label="表单名称"><a-input v-model:value="form.formName" /></a-form-item>
      <a-form-item label="Schema JSON" class="span-2">
        <a-textarea v-model:value="form.schemaJson" :rows="8" />
      </a-form-item>
      <a-form-item label="UI Schema JSON" class="span-2">
        <a-textarea v-model:value="form.uiSchemaJson" :rows="4" />
      </a-form-item>
      <a-form-item>
        <a-button type="primary" :loading="saving" @click="save"><SaveOutlined />{{ editingId ? '更新' : '创建' }}</a-button>
      </a-form-item>
      <a-form-item>
        <a-button @click="reset">重置</a-button>
      </a-form-item>
    </a-form>

    <a-table :data-source="items" :columns="columns" row-key="id" :loading="loading" :pagination="false">
      <template #emptyText>
        <a-empty description="暂无表单" />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button size="small" @click="edit(record)">编辑</a-button>
            <a-button size="small" @click="preview(record)">预览</a-button>
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
const defaultSchemaJson = JSON.stringify({
  type: 'object',
  required: ['applicant', 'leaveType', 'startDate', 'endDate', 'days', 'reason'],
  properties: {
    applicant: { type: 'string', title: '申请人' },
    leaveType: { type: 'string', title: '请假类型', enum: ['年假', '事假', '病假', '调休', '其他'] },
    startDate: { type: 'string', format: 'date', title: '开始日期' },
    endDate: { type: 'string', format: 'date', title: '结束日期' },
    days: { type: 'number', title: '请假天数' },
    reason: { type: 'string', title: '请假原因', 'ui:widget': 'textarea' },
    attachmentNote: { type: 'string', title: '附件说明', 'ui:widget': 'textarea' }
  }
}, null, 2)
const form = reactive({
  formKey: 'leave-form',
  formName: '请假申请表',
  schemaJson: defaultSchemaJson,
  uiSchemaJson: '{}'
})

const columns = [
  { title: '表单 Key', dataIndex: 'formKey', key: 'formKey' },
  { title: '表单名称', dataIndex: 'formName', key: 'formName' },
  { title: '版本', dataIndex: 'version', key: 'version', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 110 },
  { title: '操作', key: 'action', width: 160 }
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
    message.success(editingId.value ? '表单已更新' : '表单已创建')
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
  form.formKey = 'leave-form'
  form.formName = '请假申请表'
  form.schemaJson = defaultSchemaJson
  form.uiSchemaJson = '{}'
}

onMounted(load)
</script>
