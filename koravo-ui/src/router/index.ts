import { createRouter, createWebHistory } from 'vue-router'
import DashboardPage from '../pages/DashboardPage.vue'
import ProcessModelsPage from '../pages/ProcessModelsPage.vue'
import ProcessDesignerPage from '../pages/ProcessDesignerPage.vue'
import ProcessInstancesPage from '../pages/ProcessInstancesPage.vue'
import ProcessInstanceDetailPage from '../pages/ProcessInstanceDetailPage.vue'
import TasksPage from '../pages/TasksPage.vue'
import TaskDetailPage from '../pages/TaskDetailPage.vue'
import FormsPage from '../pages/FormsPage.vue'
import FormBindingsPage from '../pages/FormBindingsPage.vue'
import DataSourcesPage from '../pages/DataSourcesPage.vue'
import OpsPage from '../pages/OpsPage.vue'
import AuditLogsPage from '../pages/AuditLogsPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: DashboardPage },
    { path: '/process-models', component: ProcessModelsPage },
    { path: '/process-designer', component: ProcessDesignerPage },
    { path: '/process-instances', component: ProcessInstancesPage },
    { path: '/process-instances/:instanceId', component: ProcessInstanceDetailPage },
    { path: '/tasks', component: TasksPage },
    { path: '/tasks/:taskId', component: TaskDetailPage },
    { path: '/forms', component: FormsPage },
    { path: '/form-bindings', component: FormBindingsPage },
    { path: '/datasources', component: DataSourcesPage },
    { path: '/ops', component: OpsPage },
    { path: '/audit-logs', component: AuditLogsPage }
  ]
})

export default router
