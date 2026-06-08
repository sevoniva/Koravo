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
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorText: 'rgba(0, 0, 0, 0.88)',
    colorTextSecondary: 'rgba(0, 0, 0, 0.65)',
    colorTextTertiary: 'rgba(0, 0, 0, 0.45)',
    colorBorder: '#d9d9d9',
    colorSplit: '#f0f0f0',
    colorBgLayout: '#f0f2f5',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    borderRadius: 6,
    controlHeight: 32,
    fontSize: 14,
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      siderBg: '#ffffff',
      bodyBg: '#f0f2f5'
    },
    Menu: {
      itemBorderRadius: 6,
      itemHeight: 40,
      itemSelectedBg: '#e6f4ff',
      itemSelectedColor: '#1677ff',
      itemHoverBg: '#f5f5f5'
    },
    Table: {
      headerBg: '#fafafa',
      headerColor: 'rgba(0, 0, 0, 0.88)',
      borderColor: '#f0f0f0'
    },
    Tabs: {
      itemSelectedColor: '#1677ff'
    },
    Card: {
      borderRadiusLG: 6
    },
    Button: {
      borderRadius: 6,
      controlHeight: 32
    }
  }
}
</script>
