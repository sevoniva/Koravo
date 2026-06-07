import { createRouter, createWebHistory } from 'vue-router'
import DashboardPage from '../pages/DashboardPage.vue'
import QuickStartPage from '../pages/QuickStartPage.vue'
import ProcessModelsPage from '../pages/ProcessModelsPage.vue'
import ProcessDesignerPage from '../pages/ProcessDesignerPage.vue'
import ProcessInstancesPage from '../pages/ProcessInstancesPage.vue'
import ProcessInstanceDetailPage from '../pages/ProcessInstanceDetailPage.vue'
import TasksPage from '../pages/TasksPage.vue'
import TaskDetailPage from '../pages/TaskDetailPage.vue'
import FormsPage from '../pages/FormsPage.vue'
import FormBindingsPage from '../pages/FormBindingsPage.vue'
import DataSourcesPage from '../pages/DataSourcesPage.vue'
import ConnectorDemoPage from '../pages/ConnectorDemoPage.vue'
import OpsPage from '../pages/OpsPage.vue'
import AuditLogsPage from '../pages/AuditLogsPage.vue'
import SystemSettingsPage from '../pages/SystemSettingsPage.vue'

export const menuRoutes = [
  { path: '/dashboard', component: DashboardPage, meta: { title: '首页', menu: true, icon: 'dashboard', breadcrumb: ['首页'] } },
  { path: '/quick-start', component: QuickStartPage, meta: { title: '快速开始', menu: true, icon: 'quick', breadcrumb: ['快速开始'] } },
  { path: '/process-models', component: ProcessModelsPage, meta: { title: '流程模型', menu: true, icon: 'models', breadcrumb: ['流程模型'] } },
  { path: '/process-designer', component: ProcessDesignerPage, meta: { title: '流程设计器', menu: true, icon: 'designer', breadcrumb: ['流程设计器'] } },
  { path: '/process-instances', component: ProcessInstancesPage, meta: { title: '流程实例', menu: true, icon: 'instances', breadcrumb: ['流程实例'] } },
  { path: '/tasks', component: TasksPage, meta: { title: '我的任务', menu: true, icon: 'tasks', breadcrumb: ['我的任务'] } },
  { path: '/forms', component: FormsPage, meta: { title: '表单管理', menu: true, icon: 'forms', breadcrumb: ['表单管理'] } },
  { path: '/form-bindings', component: FormBindingsPage, meta: { title: '表单绑定', menu: true, icon: 'bindings', breadcrumb: ['表单绑定'] } },
  { path: '/datasources', component: DataSourcesPage, meta: { title: '数据源管理', menu: true, icon: 'datasources', breadcrumb: ['数据源管理'] } },
  { path: '/connector-demo', component: ConnectorDemoPage, meta: { title: 'HTTP 连接器', menu: true, icon: 'connectors', breadcrumb: ['HTTP 连接器'] } },
  { path: '/ops', component: OpsPage, meta: { title: '运维中心', menu: true, icon: 'ops', breadcrumb: ['运维中心'] } },
  { path: '/audit-logs', component: AuditLogsPage, meta: { title: '审计日志', menu: true, icon: 'audit', breadcrumb: ['审计日志'] } },
  { path: '/system-settings', component: SystemSettingsPage, meta: { title: '系统设置', menu: true, icon: 'settings', breadcrumb: ['系统设置'] } }
]

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    ...menuRoutes,
    { path: '/process-instances/:instanceId', component: ProcessInstanceDetailPage, meta: { title: '实例详情', breadcrumb: ['流程实例', '实例详情'] } },
    { path: '/tasks/:taskId', component: TaskDetailPage, meta: { title: '任务详情', breadcrumb: ['我的任务', '任务详情'] } }
  ]
})

export default router
