<template>
  <a-alert class="error-block" type="error" show-icon :message="message" :description="description" />
</template>

<script setup lang="ts">
defineProps<{
  message: string
  description?: string
}>()
</script>
