export default [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: '总览',
    icon: 'dashboard',
    component: './Dashboard',
  },
  {
    path: '/quick-start',
    name: '流程启用',
    icon: 'thunderbolt',
    component: './QuickStart',
  },
  {
    key: 'process',
    name: '流程',
    icon: 'partition',
    routes: [
      {
        path: '/process-models',
        name: '流程模型',
        icon: 'deploymentUnit',
        component: './ProcessModels',
      },
      {
        path: '/process-designer',
        name: '流程设计器',
        icon: 'edit',
        component: './ProcessDesigner',
      },
      {
        path: '/process-instances',
        name: '流程实例',
        icon: 'playCircle',
        component: './ProcessInstances',
      },
      {
        path: '/process-instances/:instanceId',
        name: '实例详情',
        hideInMenu: true,
        component: './ProcessInstanceDetail',
      },
      {
        path: '/tasks',
        name: '我的任务',
        icon: 'checkCircle',
        component: './Tasks',
      },
      {
        path: '/tasks/:taskId',
        name: '任务详情',
        hideInMenu: true,
        component: './TaskDetail',
      },
    ],
  },
  {
    key: 'forms',
    name: '表单',
    icon: 'form',
    routes: [
      {
        path: '/forms',
        name: '表单管理',
        icon: 'form',
        component: './Forms',
      },
      {
        path: '/form-bindings',
        name: '表单绑定',
        icon: 'link',
        component: './FormBindings',
      },
    ],
  },
  {
    key: 'integration',
    name: '集成',
    icon: 'api',
    routes: [
      {
        path: '/datasources',
        name: '数据源管理',
        icon: 'database',
        component: './DataSources',
      },
      {
        path: '/http-connector',
        name: 'HTTP 连接器',
        icon: 'cloudSync',
        component: './HttpConnector',
      },
    ],
  },
  {
    key: 'ops',
    name: '运维',
    icon: 'control',
    routes: [
      {
        path: '/ops',
        name: '运维中心',
        icon: 'control',
        component: './Ops',
      },
      {
        path: '/audit-logs',
        name: '审计日志',
        icon: 'fileSearch',
        component: './AuditLogs',
      },
      {
        path: '/system-settings',
        name: '系统设置',
        icon: 'setting',
        component: './SystemSettings',
      },
    ],
  },
  {
    component: './exception/404',
    layout: false,
    path: '*',
  },
];
