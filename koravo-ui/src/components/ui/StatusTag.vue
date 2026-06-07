<template>
  <a-tag :color="color">{{ label }}</a-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status?: string | boolean | null
  text?: string
}>()

const normalized = computed(() => {
  if (typeof props.status === 'boolean') return props.status ? 'READY' : 'MISSING'
  return String(props.status || 'UNKNOWN').toUpperCase()
})

const color = computed(() => {
  if (['UP', 'OK', 'READY', 'SUCCESS', 'COMPLETED', 'ACTIVE', 'DEPLOYED', 'RUNNING'].includes(normalized.value)) return 'green'
  if (['WARN', 'WARNING', 'EMPTY', 'DRAFT', 'PLANNED', 'NOT_CONFIGURED'].includes(normalized.value)) return 'orange'
  if (['DOWN', 'FAILED', 'ERROR', 'MISSING', 'DEAD'].includes(normalized.value)) return 'red'
  if (['SUSPENDED', 'DISABLED', 'ARCHIVED'].includes(normalized.value)) return 'default'
  return 'blue'
})

const label = computed(() => props.text || statusText(normalized.value))

function statusText(status: string) {
  const mapping: Record<string, string> = {
    UP: '正常',
    OK: '正常',
    READY: '就绪',
    SUCCESS: '成功',
    FAILED: '失败',
    DOWN: '异常',
    RUNNING: '运行中',
    COMPLETED: '已完成',
    ACTIVE: '启用',
    DEPLOYED: '已部署',
    DRAFT: '草稿',
    EMPTY: '暂无数据',
    MISSING: '缺失',
    NOT_CONFIGURED: '未接入',
    PLANNED: '规划中',
    SUSPENDED: '已挂起',
    DISABLED: '已禁用',
    ARCHIVED: '已归档'
  }
  return mapping[status] || status
}
</script>
