<template>
  <a-card
    class="metric-card"
    :class="{ 'metric-card-clickable': clickable }"
    :hoverable="clickable"
    :tabindex="clickable ? 0 : undefined"
    @click="handleClick"
    @keydown.enter="handleClick"
  >
    <span class="metric-card-label">{{ label }}</span>
    <strong>{{ value }}</strong>
    <span v-if="description" class="metric-card-description">{{ description }}</span>
    <StatusTag v-if="hasStatus" :status="status" />
  </a-card>
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

const emit = defineEmits<{
  click: []
}>()

const hasStatus = computed(() => props.status !== undefined && props.status !== null && props.status !== '')

function handleClick() {
  if (props.clickable) emit('click')
}
</script>
