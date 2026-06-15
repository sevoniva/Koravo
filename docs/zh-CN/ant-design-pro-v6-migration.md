# Ant Design Pro V6 迁移方案

日期：2026-06-08

## 目标

将 `koravo-ui` 迁移为官方 Ant Design Pro V6 技术栈：

- React 19
- antd 6
- Umi Max 4
- `@ant-design/pro-components` 3
- utoopack 构建
- `antd-style`
- React Query
- Biome

迁移后的页面必须是 Koravo 业务系统，不保留 Ant Design Pro 模板页面、测试账号文案、样板说明或 AI 味介绍文案。

## 官方能力接入

- 项目已安装官方 `ant-design/ant-design-pro` skills：
  - `.claude/skills/antd/SKILL.md`
  - `.claude/skills/pro-upgrade/SKILL.md`
  - `.agents/skills/antd/SKILL.md`
  - `.agents/skills/pro-upgrade/SKILL.md`
- 项目已配置 antd MCP：`.mcp.json`
- antd CLI 验证命令：
  - `npm exec --package @ant-design/cli -- antd info Button --format json --lang zh`
  - `npm exec --package @ant-design/cli -- antd mcp --help`

## 组件原则

所有页面优先使用官方组件，不手写已有组件能力：

- 页面容器：`PageContainer`
- 数据表：`ProTable`
- 查询表单：`ProTable` search 或 `QueryFilter`
- 表单：`ProForm`、`ModalForm`、`DrawerForm`、`StepsForm`
- 描述详情：`ProDescriptions`
- 数据卡片：`ProCard`、`StatisticCard`
- 状态展示：antd `Tag`、`Badge`、`Alert`、`Result`
- 操作反馈：antd `App.useApp()` 的 `message`、`modal`、`notification`
- 图标：`@ant-design/icons`
- 样式：优先使用 Ant Design token 和 ProComponents 布局能力，`antd-style` 消费 token，CSS Modules 只用于页面局部样式

写任何 antd/ProComponents 代码前，必须用官方 CLI 查询组件 API：

```bash
npm exec --package @ant-design/cli -- antd info <Component> --format json --lang zh
```

## 页面迁移范围

第一批核心工作流：

- 总览：`/dashboard`
- 配置检查：`/quick-start`（开发兜底入口，不作为主业务路径）
- 我的待办：`/tasks`
- 任务详情：`/tasks/:taskId`
- 流程实例：`/process-instances`
- 流程实例详情：`/process-instances/:instanceId`
- 运维中心：`/ops`

第二批配置能力：

- 流程模型：`/process-models`
- 流程设计器：`/process-designer`
- 表单管理：`/forms`
- 表单绑定：`/form-bindings`

第三批集成治理：

- 数据源管理：`/datasources`
- HTTP 连接器：`/http-connector`
- 审计日志：`/audit-logs`
- 系统设置：`/system-settings`

## 技术落点

- `config/routes.ts` 负责菜单、分组、图标和面包屑。
- `src/app.tsx` 保留官方 ProLayout runtime，定制当前用户、右侧动作和请求追踪入口。
- `src/requestErrorConfig.ts` 统一处理后端 `ApiResponse<T>`。
- `src/services/koravo/` 放 Koravo 后端 API，不放模板服务。
- `src/types/koravo.ts` 放业务类型。
- `src/utils/` 放格式化、脱敏、业务标签和复制辅助。
- `src/pages/**/service.ts` 只放页面私有请求包装。
- `bpmn-js` 单独封装为 React 组件，隔离生命周期和画布资源释放。

## 验收门禁

每个阶段提交前必须至少通过：

```bash
npm run lint
npm run build
npm exec --package @ant-design/cli -- antd lint ./src --format json --lang zh
git diff --check
```

首批页面完成后还必须截图验证：

- 1440px 桌面视口
- 390px 移动视口
- 左侧菜单、顶栏、面包屑、表格、表单、抽屉、弹窗无明显错位

## 文案规则

- 不使用模板痕迹、样板说明或 AI 助手生成等露怯文案。
- 页面描述只保留业务必要信息，不写产品宣传句。
- 按企业后台语气命名：总览、工作台、流程配置、组织权限、集成管理、运维审计。
- 技术 ID 默认短显示，完整值只通过复制入口提供。
