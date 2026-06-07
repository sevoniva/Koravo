# 前端审计

日期：2026-06-07

## 结论

- 路由已覆盖首页、快速开始、流程模型、设计器、实例、任务、表单、绑定、数据源、连接器、运维、审计、设置。
- 主菜单改为 route meta 驱动，避免菜单和路由不一致。
- 首页改为读取 `/api/v1/dashboard/summary`，减少页面拼装请求。
- 快速开始改为可操作步骤，支持初始化演示数据和启动请假流程。
- 连接器示例改为可部署、可启动、可查看日志和结果变量。
- 任务中心已支持关键词、状态和日期范围筛选。
- 表单管理已支持可视化字段编辑、JSON Schema 预览和表单预览。
- 表单绑定已支持从 BPMN 自动加载任务节点。
- 系统设置已显示请求头预览和系统健康。
- 数据源页保留连接测试，不提供任意 SQL 执行入口。

## 已修复

- 新增 PageHeader、PageContainer、StatusTag、EmptyState、ConfirmAction、JsonEditor、SearchBar、Toolbar、MetricCard、DetailSection、CopyableText、ErrorBlock。
- 新增 formatDateTime、formatDuration、parseJsonSafe、maskSecret、copyText。
- 新增后端 dashboard summary、demo status 增强、BPMN taskDefinitionKey 解析、连接器日志详情、系统健康、运维摘要接口。
- 表单设计器已支持字段列表、新增、删除、字段名、标题、类型、必填、占位符、下拉选项、JSON 同步和表单预览。
- 任务中心已统一 PageHeader、PageContainer、SearchBar、Toolbar、StatusTag、EmptyState，并接入后端分页筛选参数。
- 后端已显式配置 UserDetailsService，启动日志不再打印框架生成的开发密码。
- 运维中心失败任务和死信任务已支持列表、详情、重试、删除，操作写入审计日志；无数据时显示空状态。
- 前端已添加 `favicon.svg`，页面语言标记为 `zh-CN`，浏览器冒烟不再出现 favicon 404。
- 数据源页已统一 PageHeader、PageContainer、Toolbar、EmptyState、StatusTag；PostgreSQL、MySQL、H2 模板可切换 URL、用户名和驱动类。
- 数据源密码新增时不再预填，编辑时不回显；详情和列表响应不返回密码或密文字段。
- 数据源连接测试改为中文结果文案；前端按后端 `connected` 字段判断测试结果，测试日志成功列显示“成功/失败”。
- 后端运行包已包含 H2 和 MySQL JDBC 驱动，H2 模板连接测试通过。
- 流程实例列表和详情已接入 PageContainer、PageHeader、EmptyState、StatusTag、DetailSection；实例状态、任务状态和历史活动状态统一展示。
- 流程实例详情已格式化时间，变量摘要、审计详情和详情数据统一脱敏展示。
- 流程实例启动表单已按模型切换变量模板；HTTP Connector 示例使用 HTTP 业务编号和审批人变量，请假流程使用请假申请变量。
- 前端 `npm run build` 已通过。
- 后端 `mvn -s .mvn/settings-cn.xml test` 已通过。

## 待继续

- 失败任务和死信任务当前未构造异常样例，只验证了空列表、接口结构和按钮接线；后续可补一条演示异常流程做实操复验。
