<template>
  <a-layout class="app-shell">
    <a-layout-sider v-if="!isMobile" v-model:collapsed="collapsed" class="app-sider" :width="252" collapsible>
      <div class="brand" :class="{ 'brand-compact': collapsed }">
        <div class="brand-mark">K</div>
        <div v-if="!collapsed" class="brand-copy">
          <strong>Koravo</strong>
          <span>控制台</span>
        </div>
      </div>
      <a-menu class="app-nav-menu" :selectedKeys="[activeMenuKey]" theme="light" mode="inline" @click="handleNav">
        <a-menu-item-group v-for="group in navGroups" :key="group.key" :title="group.title">
          <a-menu-item v-for="item in group.items" :key="item.path">
            <component :is="item.icon" />
            <span>{{ item.title }}</span>
          </a-menu-item>
        </a-menu-item-group>
      </a-menu>
    </a-layout-sider>

    <a-drawer
      v-model:open="mobileNavOpen"
      width="300"
      placement="left"
      class="mobile-nav-drawer"
      :body-style="{ padding: 0 }"
      :closable="false"
    >
      <div class="brand">
        <div class="brand-mark">K</div>
        <div class="brand-copy">
          <strong>Koravo</strong>
          <span>控制台</span>
        </div>
      </div>
      <a-menu class="app-nav-menu" :selectedKeys="[activeMenuKey]" theme="light" mode="inline" @click="handleMobileNav">
        <a-menu-item-group v-for="group in navGroups" :key="group.key" :title="group.title">
          <a-menu-item v-for="item in group.items" :key="item.path">
            <component :is="item.icon" />
            <span>{{ item.title }}</span>
          </a-menu-item>
        </a-menu-item-group>
      </a-menu>
    </a-drawer>

    <a-layout>
      <a-layout-header class="app-header">
        <div class="header-left">
          <a-button v-if="isMobile" class="header-icon-button" type="text" @click="mobileNavOpen = true">
            <MenuOutlined />
          </a-button>
          <div>
            <div class="header-kicker">{{ currentSection }}</div>
            <div class="header-title">{{ currentTitle }}</div>
          </div>
        </div>

        <div class="header-actions">
          <a-button class="context-button" @click="router.push('/quick-start')">
            <ThunderboltOutlined />
            开始
          </a-button>
          <a-popover trigger="click" placement="bottomRight" overlay-class-name="identity-popover">
            <template #content>
              <a-form layout="vertical" class="identity-form">
                <a-form-item label="租户">
                  <a-input v-model:value="tenantId" />
                </a-form-item>
                <a-form-item label="用户">
                  <a-input v-model:value="userId" />
                </a-form-item>
                <a-form-item label="请求追踪">
                  <a-input v-model:value="requestId" placeholder="不填则后端生成" />
                </a-form-item>
                <div class="identity-meta">
                  <span>最近响应</span>
                  <code>{{ requestIdLabel(session.lastRequestId) || '暂无' }}</code>
                </div>
              </a-form>
            </template>
            <a-button class="context-button context-button-strong">
              <UserOutlined />
              {{ session.tenantId }} / {{ session.userId }}
            </a-button>
          </a-popover>
        </div>
      </a-layout-header>
      <a-layout-content class="app-content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
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
  MenuOutlined,
  PartitionOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  UserOutlined
} from '@ant-design/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import { menuRoutes } from '../router'
import { useSessionStore } from '../stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const collapsed = ref(false)
const mobileNavOpen = ref(false)
const isMobile = ref(false)
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

const groupTitleByPath = new Map<string, string>()
navGroups.forEach((group) => {
  group.items.forEach((item) => groupTitleByPath.set(item.path, group.title))
})

const activeMenuKey = computed(() => {
  const match = navItems.find((item) => route.path === item.path || route.path.startsWith(`${item.path}/`))
  return match?.path || '/dashboard'
})

const currentTitle = computed(() => String(route.meta?.title || navItems.find((item) => item.path === activeMenuKey.value)?.title || 'Koravo'))
const currentSection = computed(() => groupTitleByPath.get(activeMenuKey.value) || '控制台')

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

function handleMobileNav(event: { key: string }) {
  mobileNavOpen.value = false
  handleNav(event)
}

function requestIdLabel(requestId?: string) {
  if (!requestId) return ''
  return requestId.length > 12 ? `追踪号 ${requestId.slice(-8)}` : requestId
}

function syncViewport() {
  isMobile.value = window.matchMedia('(max-width: 960px)').matches
  if (!isMobile.value) {
    mobileNavOpen.value = false
  }
}

onMounted(() => {
  syncViewport()
  window.addEventListener('resize', syncViewport)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncViewport)
})
</script>
