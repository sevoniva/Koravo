<template>
  <div class="page-header">
    <div class="page-header-main">
      <a-breadcrumb v-if="breadcrumbs?.length" class="page-breadcrumb">
        <a-breadcrumb-item v-for="item in breadcrumbs" :key="item">{{ item }}</a-breadcrumb-item>
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
defineProps<{
  title: string
  description?: string
  breadcrumbs?: string[]
}>()
</script>
