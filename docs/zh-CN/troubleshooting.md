# 故障排查

## 前端提示无法连接后端

检查后端是否已启动：

```bash
curl http://localhost:8080/api/v1/health
```

如果后端未启动，先启动 PostgreSQL、Redis，再启动 `koravo-bootstrap`。

## 启动流程失败

检查：

- 是否已初始化演示数据
- 流程模型是否已部署
- 流程定义 Key 是否为 `leaveApproval`
- 变量 JSON 是否是对象
- `approver` 是否为当前办理用户，例如 `admin`

## 我的任务为空

检查流程变量中的 `approver`。当前开发期用户默认是 `admin`，用户任务处理人也应是 `admin`。

## 任务详情打不开

确认：

- 当前用户是任务处理人
- 请求头 `X-Tenant-Id` 与流程启动时一致
- 后端任务接口返回正常

## 审计日志为空

先执行一次初始化、启动流程或完成任务。审计日志按租户隔离，确认当前租户是 `default`。

## Maven 下载失败

国内镜像偶发下载中断时，可重试构建，或切换到官方 Maven Central。

## 前端包体积警告

当前控制台使用 Ant Design Vue 和 bpmn-js，生产构建可能提示 chunk 较大。该警告不影响访问。
