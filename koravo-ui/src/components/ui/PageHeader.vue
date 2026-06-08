<template>
  <div class="page-header">
    <div class="page-header-main">
      <a-breadcrumb v-if="resolvedBreadcrumbs.length" class="page-breadcrumb">
        <a-breadcrumb-item v-for="item in resolvedBreadcrumbs" :key="item">{{ item }}</a-breadcrumb-item>
      </a-breadcrumb>
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </div>
    <a-space v-if="$slots.actions" wrap>
      <slot name="actions" />
    </a-space>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps<{
  title: string
  description?: string
  breadcrumbs?: string[]
}>()

const route = useRoute()
const resolvedBreadcrumbs = computed(() => {
  if (props.breadcrumbs?.length) return props.breadcrumbs
  const routeBreadcrumbs = route.meta?.breadcrumb
  if (Array.isArray(routeBreadcrumbs) && routeBreadcrumbs.length) return routeBreadcrumbs.map(String)
  return [String(route.meta?.title || props.title)]
})
</script>
