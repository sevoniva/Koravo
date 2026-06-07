<template>
  <div class="search-bar">
    <a-input-search
      :value="modelValue"
      :placeholder="placeholder || '搜索'"
      allow-clear
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @search="$emit('search')"
    />
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue?: string
  placeholder?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
  search: []
}>()
</script>
