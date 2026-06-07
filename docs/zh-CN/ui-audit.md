# 前端审计

日期：2026-06-07

## 结论

- 路由已覆盖首页、快速开始、流程模型、设计器、实例、任务、表单、绑定、数据源、连接器、运维、审计、设置。
- 主菜单改为 route meta 驱动，避免菜单和路由不一致。
- 首页改为读取 `/api/v1/dashboard/summary`，减少页面拼装请求。
- 快速开始改为可操作步骤，支持初始化演示数据和启动请假流程。
- 连接器示例改为可部署、可启动、可查看日志和结果变量。
- 表单管理已支持可视化字段编辑、JSON Schema 预览和表单预览。
- 表单绑定已支持从 BPMN 自动加载任务节点。
- 系统设置已显示请求头预览和系统健康。
- 数据源页保留连接测试，不提供任意 SQL 执行入口。

## 已修复

- 新增 PageHeader、PageContainer、StatusTag、EmptyState、ConfirmAction、JsonEditor、SearchBar、Toolbar、MetricCard、DetailSection、CopyableText、ErrorBlock。
- 新增 formatDateTime、formatDuration、parseJsonSafe、maskSecret、copyText。
- 新增后端 dashboard summary、demo status 增强、BPMN taskDefinitionKey 解析、连接器日志详情、系统健康、运维摘要接口。
- 表单设计器已支持字段列表、新增、删除、字段名、标题、类型、必填、占位符、下拉选项、JSON 同步和表单预览。
- 前端 `npm run build` 已通过。
- 后端 `mvn -s .mvn/settings-cn.xml test` 已通过。

## 待继续

- 任务中心关键词和时间筛选仍需继续加强。
- 失败任务、死信任务详情和重试/删除操作仍是摘要级能力，未开放操作按钮。
