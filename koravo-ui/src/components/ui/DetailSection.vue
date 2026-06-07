<template>
  <section class="detail-section">
    <div v-if="title || $slots.actions" class="detail-section-header">
      <h2 v-if="title">{{ title }}</h2>
      <a-space v-if="$slots.actions" wrap>
        <slot name="actions" />
      </a-space>
    </div>
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{ title?: string }>()
</script>
