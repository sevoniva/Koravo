<template>
  <section class="page-container" :class="{ 'page-container-wide': wide }">
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{ wide?: boolean }>()
</script>
