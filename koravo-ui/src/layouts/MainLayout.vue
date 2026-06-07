<template>
  <a-layout class="app-shell">
    <a-layout-sider class="app-sider" :width="248" breakpoint="lg" collapsible>
      <div class="brand">
        <div class="brand-mark">K</div>
        <div>
          <strong>Koravo</strong>
          <span>流程编排控制台</span>
        </div>
      </div>
      <a-menu :selectedKeys="[activeMenuKey]" theme="dark" mode="inline" @click="handleNav">
        <a-menu-item-group v-for="group in navGroups" :key="group.key" :title="group.title">
          <a-menu-item v-for="item in group.items" :key="item.path">
            <component :is="item.icon" />
            {{ item.title }}
          </a-menu-item>
        </a-menu-item-group>
      </a-menu>
    </a-layout-sider>
    <a-layout>
      <a-layout-header class="app-header">
        <div class="header-title">Koravo 控制台</div>
        <div class="identity-strip">
          <a-input v-model:value="tenantId" size="small" addon-before="租户" />
          <a-input v-model:value="userId" size="small" addon-before="用户" />
          <a-input v-model:value="requestId" size="small" addon-before="请求追踪" placeholder="可选" />
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
  ApiOutlined,
  CheckCircleOutlined,
  ControlOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  EditOutlined,
  FileSearchOutlined,
  FormOutlined,
  LinkOutlined,
  PartitionOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  ThunderboltOutlined
} from '@ant-design/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import { menuRoutes } from '../router'
import { useSessionStore } from '../stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const iconMap = {
  dashboard: DashboardOutlined,
  quick: ThunderboltOutlined,
  models: PartitionOutlined,
  designer: EditOutlined,
  instances: PlayCircleOutlined,
  tasks: CheckCircleOutlined,
  forms: FormOutlined,
  bindings: LinkOutlined,
  datasources: DatabaseOutlined,
  connectors: ApiOutlined,
  ops: ControlOutlined,
  audit: FileSearchOutlined,
  settings: SettingOutlined
}

const navGroupMap: Record<string, string[]> = {
  start: ['/dashboard', '/quick-start'],
  process: ['/process-models', '/process-designer', '/process-instances', '/tasks'],
  forms: ['/forms', '/form-bindings'],
  integration: ['/datasources', '/connector-demo'],
  ops: ['/ops', '/audit-logs', '/system-settings']
}

const navGroupTitles: Record<string, string> = {
  start: '工作台',
  process: '流程',
  forms: '表单',
  integration: '集成',
  ops: '运维'
}

const navItems = menuRoutes
  .filter((item) => item.meta?.menu)
  .map((item) => ({
    path: item.path,
    title: String(item.meta?.title || item.path),
    icon: iconMap[String(item.meta?.icon) as keyof typeof iconMap] || DashboardOutlined
  }))

const navGroups = Object.entries(navGroupMap).map(([key, paths]) => ({
  key,
  title: navGroupTitles[key],
  items: paths
    .map((path) => navItems.find((item) => item.path === path))
    .filter((item): item is typeof navItems[number] => Boolean(item))
}))

const activeMenuKey = computed(() => {
  const match = navItems.find((item) => route.path === item.path || route.path.startsWith(`${item.path}/`))
  return match?.path || '/dashboard'
})

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
