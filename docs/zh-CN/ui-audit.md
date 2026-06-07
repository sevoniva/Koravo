# 前端审计

日期：2026-06-07

## 结论

- 路由已覆盖首页、快速开始、流程模型、设计器、实例、任务、表单、绑定、数据源、连接器、运维、审计、设置。
- 主菜单改为 route meta 驱动，并按工作台、流程、表单、集成、运维分组。
- 首页改为读取 `/api/v1/dashboard/summary`，减少页面拼装请求。
- 首页指标和最近审计已去除后端枚举、Flowable 术语和英文死信文案，默认展示中文业务动作与对象。
- 快速开始改为可操作步骤，支持初始化演示数据和启动请假流程。
- 快速开始默认展示请假申请摘要，原始启动变量移入高级详情。
- HTTP 连接器改为可部署、可启动、可查看日志和结果变量。
- 任务中心已支持关键词、状态和日期范围筛选。
- 表单管理已支持可视化字段编辑、JSON Schema 预览和表单预览。
- 表单绑定已支持从 BPMN 自动加载任务节点，默认展示已有绑定对应的流程模型。
- 审计日志已支持统一筛选、分页、详情查看和审计详情脱敏。
- 流程模型、流程设计器和运维中心已接入统一页面容器。
- 系统设置已显示请求头预览和系统健康。
- 数据源页保留连接测试，不提供任意 SQL 执行入口。

## 已修复

- 新增 PageHeader、PageContainer、StatusTag、EmptyState、ConfirmAction、JsonEditor、SearchBar、Toolbar、MetricCard、DetailSection、CopyableText、ErrorBlock。
- 新增 formatDateTime、formatDuration、parseJsonSafe、maskSecret、copyText。
- CopyableText 空值不再显示复制按钮，避免无效操作。
- 新增后端 dashboard summary、demo status 增强、BPMN taskDefinitionKey 解析、连接器日志详情、系统健康、运维摘要接口。
- 表单设计器已支持字段列表、新增、删除、字段名、标题、类型、必填、占位符、下拉选项、JSON 同步和表单预览。
- 表单详情默认展示字段摘要、字段类型和必填状态；Schema 原文移入高级详情。
- 任务中心已统一 PageHeader、PageContainer、SearchBar、Toolbar、StatusTag、EmptyState，并接入后端分页筛选参数。
- 后端已显式配置 UserDetailsService，启动日志不再打印框架生成的开发密码。
- 运维中心失败任务和死信任务已支持列表、详情、重试、删除，操作写入审计日志；无数据时显示空状态。
- 前端已添加 `favicon.svg`，页面语言标记为 `zh-CN`，浏览器冒烟不再出现 favicon 404。
- 数据源页已统一 PageHeader、PageContainer、Toolbar、EmptyState、StatusTag；PostgreSQL、MySQL、H2 模板可切换 URL、用户名和驱动类。
- 数据源密码新增时不再预填，编辑时不回显；详情和列表响应不返回密码或密文字段。
- 数据源连接测试改为中文结果文案；前端按后端 `connected` 字段判断测试结果，测试日志成功列显示“成功/失败”。
- 数据源页默认表单已移除连接池 JSON 文本区，模板、连接、只读和安全状态前置；连接池参数、详情原始配置收进高级配置。
- 后端运行包已包含 H2 和 MySQL JDBC 驱动，H2 模板连接测试通过。
- 流程实例列表和详情已接入 PageContainer、PageHeader、EmptyState、StatusTag、DetailSection；实例状态、任务状态和历史活动状态统一展示。
- 流程实例启动区默认展示业务表单，流程定义 Key 和流程变量收进高级配置。
- 流程实例详情已格式化时间，变量摘要、审计详情和详情数据统一脱敏展示。
- 流程实例详情变量和审计日志默认展示业务摘要，原始脱敏数据移入高级详情。
- 流程实例审计弹窗默认展示变更摘要；原始脱敏详情移入高级详情。
- 流程实例启动表单已按模型切换变量模板；HTTP Connector 示例使用 HTTP 业务编号和审批人变量，请假流程使用请假申请变量。
- 任务详情已接入 PageContainer、PageHeader、StatusTag、EmptyState、DetailSection、Toolbar；任务时间、审批意见、表单快照和操作记录统一格式化。
- 任务详情流程变量、任务变量、表单快照、操作记录和详情数据已脱敏展示；提交前校验绑定表单必填项。
- 任务详情申请变量、任务变量、表单快照和操作记录默认展示业务摘要；原始脱敏数据移入高级详情。
- 任务列表办理弹窗和任务详情办理区默认展示中文表单，表单数据和流程变量收进高级配置。
- 表单绑定已接入 PageContainer、PageHeader、DetailSection、Toolbar、StatusTag、CopyableText、ConfirmAction、EmptyState；新增和编辑不再手填流程模型、流程定义和任务节点。
- 审计日志已接入 PageContainer、PageHeader、DetailSection、Toolbar、EmptyState、CopyableText；列表和弹窗时间格式统一，详情 JSON 脱敏展示。
- 审计日志默认展示中文动作、对象和变更摘要；表单审计枚举已中文化，原始脱敏详情移入高级详情。
- 流程模型页已移除主视图裸 JSON，部署结果、模型详情和校验结果改为中文详情区。
- 运维中心流程实例状态和时间已中文化，默认不再展示空 JSON 详情。
- 运维中心实例详情默认展示实例摘要、当前任务和审计摘要；原始脱敏实例数据移入高级详情。
- 运维中心连接器日志已移除默认代码块和原始响应体，表格展示格式化时间、中文状态、耗时和健康摘要；执行详情默认展示调用摘要，原始请求/响应移入高级详情。
- 流程设计器移动端改为单列堆叠，避免三栏布局挤压。
- HTTP 连接器页已移除首屏 `httpConnectorDemo`、空 JSON 和 ISO 时间，默认展示调用状态、健康检查摘要、当前任务和日志摘要；原始变量与日志移入高级详情。
- 前端 `npm run build` 已通过。
- 后端 `mvn -s .mvn/settings-cn.xml test` 已通过。

## 待继续

- 失败任务和死信任务当前未构造异常样例，只验证了空列表、接口结构和按钮接线；后续可补一条演示异常流程做实操复验。
