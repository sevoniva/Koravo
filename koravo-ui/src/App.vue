<template>
  <a-config-provider :locale="zhCN">
    <MainLayout />
  </a-config-provider>
</template>

<script setup lang="ts">
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import MainLayout from './layouts/MainLayout.vue'
</script>
