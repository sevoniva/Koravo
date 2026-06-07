<template>
  <div class="empty-state">
    <a-empty :description="description || '暂无数据'">
      <slot />
    </a-empty>
  </div>
</template>

<script setup lang="ts">
defineProps<{ description?: string }>()
</script>
