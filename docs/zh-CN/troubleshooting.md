# 故障排查

## 前端提示无法连接后端

检查后端是否已启动：

```bash
curl http://localhost:8080/api/v1/health
```

如果后端未启动，先启动 PostgreSQL、Redis，再启动 `koravo-bootstrap`。

## 发起流程失败

检查：

- 「流程模型」里的配置路径是否已经走到「发起」
- 流程模型是否已发布
- 流程定义 Key 是否为 `collaborativeApproval`
- 发起表单必填字段是否已填写
- 审批人是否为当前租户内启用成员，例如 `manager`、`finance`

## 我的待办为空

检查当前登录成员和职责。协同审批流程会按所选审批人生成并行待办，可在「组织权限」确认成员状态后查看「我的待办」。

## 任务详情打不开

确认：

- 当前用户是任务处理人
- 当前登录会话和 `X-Koravo-Tenant-Id` 与流程发起时一致
- 后端任务接口返回正常

## 审计日志为空

先保存流程、发起流程或完成任务。审计日志按租户隔离，确认当前租户是 `default`。

## Maven 下载失败

国内镜像偶发下载中断时，可重试构建，或切换到官方 Maven Central。

## 前端包体积警告

当前控制台使用 Ant Design Pro、ProComponents 和 bpmn-js，生产构建可能提示 chunk 较大。该警告不影响访问。
