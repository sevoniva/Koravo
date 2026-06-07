# 冒烟测试

日期：2026-06-07

## 构建

```bash
cd koravo-ui
npm run build
```

结果：通过。

```bash
cd koravo-server
JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn -s .mvn/settings-cn.xml test
```

结果：通过。

## 页面

- 首页：通过。仪表盘摘要、最近审计、连接器摘要正常显示。
- 快速开始：通过。演示状态、流程上下文和步骤入口正常显示。
- 初始化演示数据：通过。重复初始化后流程、表单、绑定保持就绪。
- 启动请假流程：通过。创建实例 `75ede74a-625a-11f1-ab24-c232b2af3b82`，业务编号 `LEAVE-20260607-8918`。
- 我的待办：通过。启动后出现“审批请假”，提交后待办清空。
- 任务中心筛选：通过。`/tasks/my` 支持 `keyword`、`status`、`startTime`、`endTime`；浏览器输入无匹配关键词显示空状态，输入“确认”恢复待办行。
- 任务详情提交表单：通过。绑定“请假申请表 v1”，提交“同意”后写入审批变量、意见和表单快照。
- 流程追踪：通过。请假实例完成后状态为 `COMPLETED`，流程图 SVG 渲染，变量包含 `approved=true` 和 `approvalAction=同意`。
- 表单设计器：通过。`/forms` 渲染字段列表和表单预览，点击“新增字段”后生成 `field8`，JSON Schema 和预览同步更新。
- 审计日志：通过。可查询 `TASK_COMPLETE`，任务详情返回对应审计记录。
- HTTP Connector 示例：通过。部署 `httpConnectorDemo`，启动实例 `cb7fb909-625a-11f1-ab24-c232b2af3b82`，`httpResult.statusCode=200`，连接器日志为 `SUCCESS`。
- 运维 tabs：通过。实例列表、异常摘要、运行中实例和完成实例可见。
- 系统设置切换租户用户：通过。请求上下文、请求头预览、系统健康、依赖状态和 URL 策略可见。
- 刷新页面路由：通过。`/dashboard`、`/connector-demo`、`/ops`、`/system-settings` 直接访问正常。
- 启动日志：通过。后端启动后未出现 `Using generated security password` 或 `generated password`。

## 修复记录

- 连接器详情接口 `GET /api/v1/connector-execution-logs/{id}` 在 PostgreSQL LOB 字段读取时曾返回 500，已通过只读事务边界修复并复验通过。
- 首页和连接器示例的指标卡曾在未传入状态时显示“缺失”，已修复为仅在明确传入状态时显示状态标签。
- Spring Security 默认开发密码曾出现在启动日志，已通过显式 `UserDetailsService` 配置关闭。

## 已知问题

- 后端 jar 用 `Ctrl+C` 停止时会打印 Spring Boot/Tomcat/Netty/Flowable 销毁阶段的 `NoClassDefFoundError` 警告；服务进程会退出，8080 会释放，需后续单独定位打包或停机生命周期依赖问题。
- 前端生产构建提示主包超过 500 kB；当前不影响运行，后续可做路由级代码拆分。
