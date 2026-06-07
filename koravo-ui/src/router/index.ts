import { createRouter, createWebHistory } from 'vue-router'
import DashboardPage from '../pages/DashboardPage.vue'
import ProcessModelsPage from '../pages/ProcessModelsPage.vue'
import ProcessInstancesPage from '../pages/ProcessInstancesPage.vue'
import TasksPage from '../pages/TasksPage.vue'
import DataSourcesPage from '../pages/DataSourcesPage.vue'
import OpsPage from '../pages/OpsPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: DashboardPage },
    { path: '/process-models', component: ProcessModelsPage },
    { path: '/process-instances', component: ProcessInstancesPage },
    { path: '/tasks', component: TasksPage },
    { path: '/datasources', component: DataSourcesPage },
    { path: '/ops', component: OpsPage }
  ]
})

export default router
