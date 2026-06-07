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
        <a-menu-item key="/process-designer"><EditOutlined />Process Designer</a-menu-item>
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
        <div class="header-title">Koravo v0.2/v0.3 Console</div>
        <div class="identity-strip">
          <a-input v-model:value="tenantId" size="small" addon-before="Tenant" />
          <a-input v-model:value="userId" size="small" addon-before="User" />
          <a-input v-model:value="requestId" size="small" addon-before="Request" placeholder="optional" />
        </div>
      </a-layout-header>
      <a-layout-content class="app-content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  CheckCircleOutlined,
  ControlOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  EditOutlined,
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

const tenantId = computed({
  get: () => session.tenantId,
  set: (value) => session.setTenantId(value)
})

const userId = computed({
  get: () => session.userId,
  set: (value) => session.setUserId(value)
})

const requestId = computed({
  get: () => session.requestId,
  set: (value) => session.setRequestId(value)
})

function handleNav(event: { key: string }) {
  router.push(event.key)
}
</script>
