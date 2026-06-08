<template>
  <a-config-provider :locale="zhCN" :theme="theme">
    <MainLayout />
  </a-config-provider>
</template>

<script setup lang="ts">
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import MainLayout from './layouts/MainLayout.vue'

const theme = {
  token: {
    colorPrimary: '#1677ff',
    colorInfo: '#1677ff',
    colorSuccess: '#389e0d',
    colorWarning: '#d48806',
    colorError: '#cf1322',
    colorText: '#17212b',
    colorTextSecondary: '#667789',
    colorBorder: '#d8e0e7',
    colorBgLayout: '#f6f8fb',
    colorBgContainer: '#ffffff',
    borderRadius: 8,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)'
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      siderBg: '#ffffff',
      bodyBg: '#f6f8fb'
    },
    Menu: {
      itemBorderRadius: 8,
      itemSelectedBg: '#eaf3ff',
      itemSelectedColor: '#1677ff',
      itemHoverBg: '#f3f7fb'
    },
    Table: {
      headerBg: '#f5f8fb',
      headerColor: '#405468'
    },
    Tabs: {
      itemSelectedColor: '#1677ff'
    }
  }
}
</script>
