<template>
  <a-layout class="app-shell">
    <a-layout-sider class="app-sider" :width="248" breakpoint="lg" collapsible>
      <div class="brand">
        <div class="brand-mark">K</div>
        <div>
          <strong>Koravo</strong>
          <span>Orchestration Console</span>
        </div>
      </div>
      <a-menu :selectedKeys="[route.path]" theme="dark" mode="inline" @click="handleNav">
        <a-menu-item key="/dashboard"><DashboardOutlined />Dashboard</a-menu-item>
        <a-menu-item key="/process-models"><PartitionOutlined />Process Models</a-menu-item>
        <a-menu-item key="/process-instances"><PlayCircleOutlined />Process Instances</a-menu-item>
        <a-menu-item key="/tasks"><CheckCircleOutlined />Tasks</a-menu-item>
        <a-menu-item key="/forms"><FormOutlined />Forms</a-menu-item>
        <a-menu-item key="/form-bindings"><LinkOutlined />Form Bindings</a-menu-item>
        <a-menu-item key="/datasources"><DatabaseOutlined />Data Sources</a-menu-item>
        <a-menu-item key="/ops"><ControlOutlined />Ops</a-menu-item>
        <a-menu-item key="/audit-logs"><FileSearchOutlined />Audit Logs</a-menu-item>
      </a-menu>
    </a-layout-sider>
    <a-layout>
      <a-layout-header class="app-header">
        <div class="header-title">Koravo v0.1 Foundation</div>
        <div class="identity-strip">
          <a-input v-model:value="session.tenantId" size="small" addon-before="Tenant" />
          <a-input v-model:value="session.userId" size="small" addon-before="User" />
        </div>
      </a-layout-header>
      <a-layout-content class="app-content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import {
  CheckCircleOutlined,
  ControlOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  FormOutlined,
  LinkOutlined,
  PartitionOutlined,
  PlayCircleOutlined
} from '@ant-design/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

function handleNav(event: { key: string }) {
  router.push(event.key)
}
</script>
