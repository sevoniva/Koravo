<template>
  <PageContainer wide>
    <PageHeader title="表单管理" description="设计任务表单，保存为 JSON Schema。">
      <template #actions>
        <a-button :loading="loading" @click="load"><ReloadOutlined />刷新</a-button>
        <a-button @click="loadLeaveTemplate"><FormOutlined />请假模板</a-button>
        <a-button @click="reset"><PlusOutlined />新建</a-button>
        <a-button type="primary" :loading="saving" @click="save"><SaveOutlined />{{ editingId ? '更新' : '创建' }}</a-button>
      </template>
    </PageHeader>

    <div class="form-designer-grid">
      <DetailSection title="表单信息">
        <a-form layout="vertical" class="compact-form-grid">
          <a-form-item label="表单 Key">
            <a-input v-model:value="form.formKey" />
          </a-form-item>
          <a-form-item label="表单名称">
            <a-input v-model:value="form.formName" />
          </a-form-item>
        </a-form>

        <div class="field-toolbar">
          <strong>字段</strong>
          <a-space>
            <a-button size="small" @click="addField"><PlusOutlined />新增字段</a-button>
            <a-button size="small" @click="syncJsonFromFields">生成 JSON</a-button>
          </a-space>
        </div>

        <EmptyState v-if="!fields.length" description="暂无字段" />
        <div v-else class="field-list">
          <button
            v-for="field in fields"
            :key="field.id"
            type="button"
            class="field-list-item"
            :class="{ active: field.id === selectedFieldId }"
            @click="selectField(field.id)"
          >
            <span>
              <strong>{{ field.title || field.name || '未命名字段' }}</strong>
              <small>{{ field.name || '-' }} · {{ fieldTypeText(field.type) }}</small>
            </span>
            <StatusTag :status="field.required ? 'READY' : 'EMPTY'" :text="field.required ? '必填' : '选填'" />
          </button>
        </div>
      </DetailSection>

      <DetailSection title="字段属性">
        <a-empty v-if="!selectedField" description="选择字段后编辑" />
        <a-form v-else layout="vertical" class="compact-form-grid">
          <a-form-item label="字段名">
            <a-input v-model:value="selectedField.name" @change="syncJsonFromFields" />
          </a-form-item>
          <a-form-item label="标题">
            <a-input v-model:value="selectedField.title" @change="syncJsonFromFields" />
          </a-form-item>
          <a-form-item label="类型">
            <a-select v-model:value="selectedField.type" @change="handleFieldTypeChange">
              <a-select-option value="text">文本</a-select-option>
              <a-select-option value="textarea">多行文本</a-select-option>
              <a-select-option value="number">数字</a-select-option>
              <a-select-option value="date">日期</a-select-option>
              <a-select-option value="select">下拉</a-select-option>
              <a-select-option value="boolean">布尔值</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="必填">
            <a-switch v-model:checked="selectedField.required" @change="syncJsonFromFields" />
          </a-form-item>
          <a-form-item label="占位符" class="span-2">
            <a-input v-model:value="selectedField.placeholder" @change="syncJsonFromFields" />
          </a-form-item>
          <a-form-item v-if="selectedField.type === 'select'" label="下拉选项" class="span-2">
            <a-textarea
              v-model:value="selectedField.optionsText"
              :rows="4"
              placeholder="每行一个选项"
              @change="syncJsonFromFields"
            />
          </a-form-item>
          <a-form-item>
            <a-button danger @click="removeSelectedField"><DeleteOutlined />删除字段</a-button>
          </a-form-item>
        </a-form>
      </DetailSection>

      <DetailSection title="表单预览">
        <SchemaForm v-model="previewData" :schema-json="form.schemaJson" />
      </DetailSection>

      <DetailSection title="JSON Schema">
        <a-tabs>
          <a-tab-pane key="schema" tab="Schema">
            <JsonEditor v-model="form.schemaJson" object-only :rows="14" @valid="handleSchemaJsonValid" />
          </a-tab-pane>
          <a-tab-pane key="ui" tab="UI Schema">
            <JsonEditor v-model="form.uiSchemaJson" object-only :rows="10" />
          </a-tab-pane>
        </a-tabs>
      </DetailSection>
    </div>

    <DetailSection title="已保存表单">
      <a-table :data-source="items" :columns="columns" row-key="id" :loading="loading" :pagination="false" size="small">
        <template #emptyText>
          <a-empty description="暂无表单" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <StatusTag :status="record.status" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button size="small" @click="edit(record)">编辑</a-button>
              <a-button size="small" @click="preview(record)">查看</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </DetailSection>

    <JsonPreview :value="selected" />
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { DeleteOutlined, FormOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons-vue'
import JsonPreview from '../components/JsonPreview.vue'
import SchemaForm from '../components/SchemaForm.vue'
import {
  createFormSchema,
  getFormSchema,
  listFormSchemas,
  updateFormSchema,
  type FormSchemaItem,
  type JsonRecord
} from '../api/koravo'
import { DetailSection, EmptyState, JsonEditor, PageContainer, PageHeader, StatusTag } from '../components/ui'
import { JsonInputError, parseJsonObject } from '../utils/jsonInput'

type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'boolean'

type DesignerField = {
  id: string
  name: string
  title: string
  type: FieldType
  required: boolean
  placeholder: string
  optionsText: string
}

type SchemaJson = {
  type?: string
  required?: string[]
  properties?: Record<string, {
    type?: string
    title?: string
    format?: string
    enum?: string[]
    'ui:widget'?: string
    'ui:placeholder'?: string
  }>
}

const loading = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const items = ref<FormSchemaItem[]>([])
const selected = ref<FormSchemaItem | null>(null)
const fields = ref<DesignerField[]>([])
const selectedFieldId = ref('')
const previewData = ref<JsonRecord>({})
let syncingFromDesigner = false

const leaveSchema = {
  type: 'object',
  required: ['applicant', 'leaveType', 'startDate', 'endDate', 'days', 'reason'],
  properties: {
    applicant: { type: 'string', title: '申请人', 'ui:placeholder': '请输入申请人' },
    leaveType: { type: 'string', title: '请假类型', enum: ['年假', '事假', '病假', '调休', '其他'] },
    startDate: { type: 'string', format: 'date', title: '开始日期' },
    endDate: { type: 'string', format: 'date', title: '结束日期' },
    days: { type: 'number', title: '请假天数' },
    reason: { type: 'string', title: '请假原因', 'ui:widget': 'textarea', 'ui:placeholder': '请输入请假原因' },
    attachmentNote: { type: 'string', title: '附件说明', 'ui:widget': 'textarea' }
  }
}

const form = reactive({
  formKey: 'leave-form',
  formName: '请假申请表',
  schemaJson: JSON.stringify(leaveSchema, null, 2),
  uiSchemaJson: JSON.stringify({
    reason: { widget: 'textarea' },
    attachmentNote: { widget: 'textarea' }
  }, null, 2)
})

const selectedField = computed(() => fields.value.find((field) => field.id === selectedFieldId.value) || null)

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
  syncJsonFromFields()
  let schema: JsonRecord
  try {
    schema = parseJsonObject(form.schemaJson, 'Schema JSON')
    if (form.uiSchemaJson) parseJsonObject(form.uiSchemaJson, 'UI Schema JSON')
  } catch (error) {
    if (error instanceof JsonInputError) {
      message.error(error.message)
    }
    return
  }
  const errors = validateDesignerFields(schema)
  if (errors.length) {
    message.error(errors[0])
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
  syncFieldsFromJson()
}

async function preview(record: FormSchemaItem) {
  selected.value = await getFormSchema(record.id)
  form.formKey = selected.value.formKey
  form.formName = selected.value.formName
  form.schemaJson = selected.value.schemaJson
  form.uiSchemaJson = selected.value.uiSchemaJson || '{}'
  syncFieldsFromJson()
}

function reset() {
  editingId.value = null
  form.formKey = 'leave-form'
  form.formName = '请假申请表'
  form.schemaJson = JSON.stringify(leaveSchema, null, 2)
  form.uiSchemaJson = JSON.stringify({
    reason: { widget: 'textarea' },
    attachmentNote: { widget: 'textarea' }
  }, null, 2)
  selected.value = null
  previewData.value = {}
  syncFieldsFromJson()
}

function loadLeaveTemplate() {
  reset()
  message.success('已加载请假申请表模板')
}

function addField() {
  const nextName = uniqueFieldName('field')
  const field: DesignerField = {
    id: `field-${Date.now()}-${fields.value.length}`,
    name: nextName,
    title: '新字段',
    type: 'text',
    required: false,
    placeholder: '',
    optionsText: ''
  }
  fields.value.push(field)
  selectedFieldId.value = field.id
  syncJsonFromFields()
}

function selectField(id: string) {
  selectedFieldId.value = id
}

function removeSelectedField() {
  if (!selectedField.value) return
  fields.value = fields.value.filter((field) => field.id !== selectedField.value?.id)
  selectedFieldId.value = fields.value[0]?.id || ''
  syncJsonFromFields()
}

function handleFieldTypeChange() {
  if (selectedField.value?.type === 'select' && !selectedField.value.optionsText.trim()) {
    selectedField.value.optionsText = '选项一\n选项二'
  }
  syncJsonFromFields()
}

function syncFieldsFromJson(value?: unknown) {
  const parsed = (value || parseJsonSafe(form.schemaJson)) as SchemaJson
  const required = new Set(parsed.required || [])
  fields.value = Object.entries(parsed.properties || {}).map(([name, property], index) => ({
    id: `field-${index}-${name}`,
    name,
    title: property.title || name,
    type: toDesignerType(property),
    required: required.has(name),
    placeholder: property['ui:placeholder'] || '',
    optionsText: (property.enum || []).join('\n')
  }))
  selectedFieldId.value = fields.value[0]?.id || ''
}

function syncJsonFromFields() {
  const required = fields.value
    .filter((field) => field.required && field.name.trim())
    .map((field) => field.name.trim())
  const properties: NonNullable<SchemaJson['properties']> = {}
  for (const field of fields.value) {
    const name = field.name.trim()
    if (!name) continue
    properties[name] = toSchemaProperty(field)
  }
  syncingFromDesigner = true
  form.schemaJson = JSON.stringify({
    type: 'object',
    required,
    properties
  }, null, 2)
  form.uiSchemaJson = JSON.stringify(buildUiSchema(), null, 2)
  queueMicrotask(() => {
    syncingFromDesigner = false
  })
}

function handleSchemaJsonValid(value: unknown) {
  if (syncingFromDesigner) return
  syncFieldsFromJson(value)
}

function toSchemaProperty(field: DesignerField) {
  const property: NonNullable<SchemaJson['properties']>[string] = {
    type: field.type === 'number' ? 'number' : field.type === 'boolean' ? 'boolean' : 'string',
    title: field.title.trim() || field.name.trim()
  }
  if (field.type === 'textarea') {
    property['ui:widget'] = 'textarea'
  }
  if (field.type === 'date') {
    property.format = 'date'
  }
  if (field.type === 'select') {
    property.enum = field.optionsText.split('\n').map((item) => item.trim()).filter(Boolean)
  }
  if (field.placeholder.trim()) {
    property['ui:placeholder'] = field.placeholder.trim()
  }
  return property
}

function buildUiSchema() {
  const uiSchema: Record<string, Record<string, string>> = {}
  for (const field of fields.value) {
    const name = field.name.trim()
    if (!name) continue
    const config: Record<string, string> = {}
    if (field.type === 'textarea') config.widget = 'textarea'
    if (field.placeholder.trim()) config.placeholder = field.placeholder.trim()
    if (Object.keys(config).length) uiSchema[name] = config
  }
  return uiSchema
}

function validateDesignerFields(schema: JsonRecord) {
  const errors: string[] = []
  if (!form.formKey.trim()) errors.push('表单 Key 不能为空')
  if (!form.formName.trim()) errors.push('表单名称不能为空')
  const names = fields.value.map((field) => field.name.trim()).filter(Boolean)
  if (fields.value.some((field) => !field.name.trim())) errors.push('字段名不能为空')
  if (new Set(names).size !== names.length) errors.push('字段名不能重复')
  for (const field of fields.value) {
    if (field.type === 'select' && !field.optionsText.split('\n').some((item) => item.trim())) {
      errors.push(`下拉字段「${field.title || field.name}」至少需要一个选项`)
    }
  }
  if (schema.type !== 'object') errors.push('Schema type 必须是 object')
  return errors
}

function parseJsonSafe(value: string) {
  try {
    return JSON.parse(value || '{}')
  } catch {
    return {}
  }
}

function toDesignerType(property: NonNullable<SchemaJson['properties']>[string]): FieldType {
  if (property.enum?.length) return 'select'
  if (property.type === 'boolean') return 'boolean'
  if (property.type === 'number' || property.type === 'integer') return 'number'
  if (property.format === 'date') return 'date'
  if (property['ui:widget'] === 'textarea') return 'textarea'
  return 'text'
}

function uniqueFieldName(base: string) {
  const existing = new Set(fields.value.map((field) => field.name))
  let index = fields.value.length + 1
  let name = `${base}${index}`
  while (existing.has(name)) {
    index += 1
    name = `${base}${index}`
  }
  return name
}

function fieldTypeText(type: FieldType) {
  const mapping: Record<FieldType, string> = {
    text: '文本',
    textarea: '多行文本',
    number: '数字',
    date: '日期',
    select: '下拉',
    boolean: '布尔值'
  }
  return mapping[type]
}

onMounted(async () => {
  syncFieldsFromJson()
  await load()
})
</script>
