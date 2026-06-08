# Koravo 中文快速说明

Koravo 是基于 Flowable 的流程与数据编排控制台。当前版本包含流程模型、BPMN 设计器、表单、任务、流程追踪、HTTP Connector、数据源和审计日志。

## 启动依赖

```bash
cp .env.example .env
docker compose up -d postgres redis minio
```

默认数据库：

- 地址：`127.0.0.1:15432`
- 数据库：`koravo`
- 用户名：`koravo`
- 密码：`koravo`

## 启动后端

```bash
cd koravo-server
mvn -pl koravo-bootstrap -am -DskipTests package
POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=15432 \
REDIS_HOST=127.0.0.1 REDIS_PORT=6379 \
java -jar koravo-bootstrap/target/koravo-bootstrap-0.1.0-SNAPSHOT.jar
```

健康检查：

```bash
curl -H 'X-Tenant-Id: default' -H 'X-User-Id: admin' \
  http://localhost:8080/api/v1/health
```

## 启动前端

```bash
cd koravo-ui
npm install
npm run dev
```

打开 `http://localhost:8000`。

## 跑通采购申请

1. 进入「流程设计」，新建流程模型，或导入 `examples/bpmn/purchase-approval.bpmn20.xml`。
2. 保存并部署「采购申请流程」，确认流程定义 Key 为 `purchaseApproval`。
3. 进入「表单管理」，创建「采购申请单」。
4. 进入「表单绑定」，将表单绑定到 `managerApprovalTask` 和 `financeApprovalTask`。
5. 进入「流程实例」，选择「采购申请流程」并发起实例。
6. 进入「任务中心」，分别处理「部门审批」和「财务审批」。
7. 回到「流程实例」打开实例详情，查看当前任务、执行轨迹和表单快照。
8. 进入「审计日志」，按实例编号或追踪号查询流程启动、任务完成等记录。

## 常用入口

- 首页：查看后端状态、流程配置状态、任务和连接器摘要。
- 流程设计：创建、导入和编辑 BPMN 流程。
- 流程模型：查看、校验、部署、导出模型。
- 任务中心：处理待办、查看已办和我发起的流程。
- 运维中心：查看实例、流程追踪、连接器日志和异常摘要。

## 构建检查

```bash
cd koravo-ui
npm run build
```

```bash
cd koravo-server
mvn -pl koravo-bootstrap -am test
```

如果 Maven 国内镜像下载失败，可使用官方仓库重试。
