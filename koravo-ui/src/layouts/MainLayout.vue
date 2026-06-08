<template>
  <a-layout class="app-shell">
    <a-layout-header class="app-header">
      <div class="header-left">
        <a-button v-if="isMobile" class="header-icon-button" type="text" @click="mobileNavOpen = true">
          <MenuOutlined />
        </a-button>
        <div class="global-brand">
          <div class="brand-mark">K</div>
          <div class="brand-copy">
            <strong>Koravo</strong>
            <span>控制台</span>
          </div>
        </div>
      </div>

      <div class="header-actions">
        <a-button class="header-action-button" type="text" @click="router.push('/quick-start')">
          <ThunderboltOutlined />
          <span v-if="!isMobile">流程启用</span>
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
          <a-button class="header-action-button" type="text">
            <UserOutlined />
            <span v-if="!isMobile">{{ session.tenantId }} / {{ session.userId }}</span>
          </a-button>
        </a-popover>
      </div>
    </a-layout-header>

    <a-layout>
      <a-layout-sider v-if="!isMobile" v-model:collapsed="collapsed" class="app-sider" :width="256" :trigger="null" collapsible>
        <a-button class="sider-collapse-trigger" type="text" @click="collapsed = !collapsed">
          <RightOutlined v-if="collapsed" />
          <LeftOutlined v-else />
        </a-button>
        <a-menu
          class="app-nav-menu"
          :selectedKeys="[activeMenuKey]"
          :openKeys="collapsed ? [] : openKeys"
          theme="light"
          mode="inline"
          @click="handleNav"
          @openChange="handleOpenChange"
        >
          <a-sub-menu v-for="group in navGroups" :key="group.key">
            <template #icon><component :is="group.icon" /></template>
            <template #title>{{ group.title }}</template>
            <a-menu-item v-for="item in group.items" :key="item.path">
              <component :is="item.icon" />
              <span>{{ item.title }}</span>
            </a-menu-item>
          </a-sub-menu>
        </a-menu>
      </a-layout-sider>

      <a-layout-content class="app-content">
        <router-view />
      </a-layout-content>
    </a-layout>

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
      <a-menu
        class="app-nav-menu"
        :selectedKeys="[activeMenuKey]"
        :openKeys="openKeys"
        theme="light"
        mode="inline"
        @click="handleMobileNav"
        @openChange="handleOpenChange"
      >
        <a-sub-menu v-for="group in navGroups" :key="group.key">
          <template #icon><component :is="group.icon" /></template>
          <template #title>{{ group.title }}</template>
          <a-menu-item v-for="item in group.items" :key="item.path">
            <component :is="item.icon" />
            <span>{{ item.title }}</span>
          </a-menu-item>
        </a-sub-menu>
      </a-menu>
    </a-drawer>

    <a-button v-if="!isMobile" class="setting-drawer-trigger" type="primary" @click="router.push('/system-settings')">
      <SettingOutlined />
    </a-button>

  </a-layout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ApiOutlined,
  CheckCircleOutlined,
  ControlOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  EditOutlined,
  FileSearchOutlined,
  FormOutlined,
  LeftOutlined,
  LinkOutlined,
  MenuOutlined,
  PartitionOutlined,
  PlayCircleOutlined,
  RightOutlined,
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
const openKeys = ref<string[]>([])
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
  integration: ['/datasources', '/http-connector'],
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

const groupIconMap = {
  start: DashboardOutlined,
  process: PartitionOutlined,
  forms: FormOutlined,
  integration: DatabaseOutlined,
  ops: ControlOutlined
}

const navGroups = Object.entries(navGroupMap).map(([key, paths]) => ({
  key,
  title: navGroupTitles[key],
  icon: groupIconMap[key as keyof typeof groupIconMap] || DashboardOutlined,
  items: paths
    .map((path) => navItems.find((item) => item.path === path))
    .filter((item): item is typeof navItems[number] => Boolean(item))
}))

const activeMenuKey = computed(() => {
  const match = navItems.find((item) => route.path === item.path || route.path.startsWith(`${item.path}/`))
  return match?.path || '/dashboard'
})

const activeGroupKey = computed(() => navGroups.find((group) => group.items.some((item) => item.path === activeMenuKey.value))?.key || 'start')

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

function handleOpenChange(keys: string[]) {
  openKeys.value = keys.slice(-1)
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

watch(activeGroupKey, (key) => {
  openKeys.value = key ? [key] : []
}, { immediate: true })

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncViewport)
})
</script>
