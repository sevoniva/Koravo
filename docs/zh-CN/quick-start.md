# 快速开始

## 1. 启动依赖

在项目根目录执行：

```bash
docker compose up -d postgres redis minio
```

看到 PostgreSQL、Redis、MinIO 容器启动后继续。

## 2. 启动后端和前端

后端启动后访问 `http://localhost:8080/swagger-ui.html` 可查看接口。

前端启动后打开 `http://localhost:8000`。

## 3. 初始化流程配置

进入「快速开始」，点击「初始化配置」。

初始化会创建：

- 请假审批流程 `leaveApproval`
- 请假申请表 `leave-form`
- 审批任务节点 `approveTask` 的表单绑定

重复点击不会生成大量重复数据。

## 4. 启动请假流程

进入「流程实例」。

选择「请假审批流程」，保留默认变量：

```json
{
  "applicant": "张三",
  "approver": "admin",
  "leaveType": "年假",
  "days": 2,
  "reason": "家庭事务"
}
```

点击「启动流程」。

## 5. 处理待办

进入「我的任务」，打开「审批请假」。

填写表单，选择「同意」或「拒绝」，填写审批意见，点击「提交」。

## 6. 查看结果

进入「流程实例」打开实例详情。

应能看到：

- 实例状态
- 当前节点
- 已完成节点
- 流程变量
- BPMN 高亮图

进入「审计日志」可查看关键操作记录。
