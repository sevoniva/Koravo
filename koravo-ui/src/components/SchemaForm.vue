<template>
  <div class="schema-form">
    <a-empty v-if="!fields.length" description="暂无可渲染字段" />
    <a-form v-else layout="vertical" class="schema-form-grid">
      <a-form-item
        v-for="field in fields"
        :key="field.key"
        :label="field.label"
        :required="field.required"
        :class="{ 'span-2': field.widget === 'textarea' }"
      >
        <a-textarea
          v-if="field.widget === 'textarea'"
          v-model:value="model[field.key]"
          :placeholder="`请输入${field.label}`"
          :rows="3"
          @change="emitChange"
        />
        <a-select
          v-else-if="field.enumValues.length"
          v-model:value="model[field.key]"
          :placeholder="`请选择${field.label}`"
          @change="emitChange"
        >
          <a-select-option v-for="option in field.enumValues" :key="option" :value="option">
            {{ option }}
          </a-select-option>
        </a-select>
        <a-date-picker
          v-else-if="field.format === 'date'"
          :value="dateValue(field.key)"
          value-format="YYYY-MM-DD"
          style="width: 100%"
          @change="(value: string | string[]) => updateDate(field.key, value)"
        />
        <a-switch
          v-else-if="field.type === 'boolean'"
          v-model:checked="model[field.key]"
          @change="emitChange"
        />
        <a-input-number
          v-else-if="field.type === 'number' || field.type === 'integer'"
          v-model:value="model[field.key]"
          :precision="field.type === 'integer' ? 0 : undefined"
          style="width: 100%"
          @change="emitChange"
        />
        <a-input
          v-else
          v-model:value="model[field.key]"
          :placeholder="`请输入${field.label}`"
          @change="emitChange"
        />
      </a-form-item>
    </a-form>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { JsonRecord } from '../api/koravo'

type SchemaField = {
  key: string
  label: string
  type: 'string' | 'number' | 'integer' | 'boolean'
  format?: string
  widget?: string
  required: boolean
  enumValues: string[]
}

const props = defineProps<{
  schemaJson?: string
  modelValue: JsonRecord
}>()

const emit = defineEmits<{
  'update:modelValue': [value: JsonRecord]
  fieldsChange: [fields: SchemaField[]]
}>()

const model = reactive<JsonRecord>({})

const fields = computed<SchemaField[]>(() => {
  if (!props.schemaJson) return []
  try {
    const schema = JSON.parse(props.schemaJson) as {
      required?: string[]
      properties?: Record<string, {
        type?: string
        title?: string
        format?: string
        enum?: string[]
        'ui:widget'?: string
      }>
    }
    const required = new Set(schema.required || [])
    return Object.entries(schema.properties || {})
      .map(([key, property]) => ({
        key,
        label: property.title || key,
        type: normalizeType(property.type),
        format: property.format,
        widget: property['ui:widget'],
        required: required.has(key),
        enumValues: property.enum || []
      }))
  } catch {
    return []
  }
})

watch(
  () => props.modelValue,
  (value) => {
    for (const key of Object.keys(model)) {
      delete model[key]
    }
    Object.assign(model, value || {})
    for (const field of fields.value) {
      if (model[field.key] === undefined && field.type === 'boolean') {
        model[field.key] = false
      }
    }
  },
  { immediate: true, deep: true }
)

watch(fields, () => {
  for (const field of fields.value) {
    if (model[field.key] === undefined && field.type === 'boolean') {
      model[field.key] = false
    }
  }
  emit('fieldsChange', fields.value)
  emitChange()
}, { immediate: true })

function normalizeType(type?: string): SchemaField['type'] {
  if (type === 'number' || type === 'integer' || type === 'boolean') {
    return type
  }
  return 'string'
}

function emitChange() {
  const value = Object.fromEntries(
    Object.entries(model).filter(([, nextValue]) => nextValue !== undefined && nextValue !== '')
  )
  emit('update:modelValue', value)
}

function dateValue(key: string) {
  const value = model[key]
  return typeof value === 'string' ? value : undefined
}

function updateDate(key: string, value: string | string[]) {
  model[key] = Array.isArray(value) ? value[0] : value
  emitChange()
}
</script>
