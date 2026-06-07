<template>
  <button class="metric-card" type="button" :disabled="!clickable" @click="$emit('click')">
    <span class="metric-card-label">{{ label }}</span>
    <strong>{{ value }}</strong>
    <span v-if="description" class="metric-card-description">{{ description }}</span>
    <StatusTag v-if="hasStatus" :status="status" />
  </button>
</template>

<script setup lang="ts">
import StatusTag from './StatusTag.vue'
import { computed } from 'vue'

const props = defineProps<{
  label: string
  value: string | number
  description?: string
  status?: string | null
  clickable?: boolean
}>()

defineEmits<{
  click: []
}>()

const hasStatus = computed(() => props.status !== undefined && props.status !== null && props.status !== '')
</script>
