<template>
  <div class="json-editor">
    <a-textarea
      :value="text"
      :rows="rows || 10"
      spellcheck="false"
      @change="handleChange"
    />
    <a-alert v-if="error" class="json-editor-error" type="error" :message="error" show-icon />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: string
  rows?: number
  objectOnly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  valid: [value: unknown]
}>()

const text = ref(props.modelValue)
const error = ref('')

watch(
  () => props.modelValue,
  (value) => {
    text.value = value
    validate(value)
  },
  { immediate: true }
)

function handleChange(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value
  text.value = value
  emit('update:modelValue', value)
  validate(value)
}

function validate(value: string) {
  try {
    const parsed = JSON.parse(value || '{}')
    if (props.objectOnly && (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))) {
      error.value = '必须是 JSON 对象'
      return
    }
    error.value = ''
    emit('valid', parsed)
  } catch {
    error.value = 'JSON 格式无效'
  }
}
</script>
