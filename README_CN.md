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

打开 `http://localhost:5173`。

## 跑通请假审批

1. 进入「快速开始」。
2. 点击「初始化演示数据」。
3. 进入「流程实例」。
4. 选择「请假审批流程」，确认流程定义 Key 为 `leaveApproval`。
5. 使用默认变量启动流程。
6. 进入「我的任务」。
7. 打开「审批请假」任务。
8. 填写请假申请表和审批意见。
9. 点击「提交」。
10. 回到「流程实例」打开实例详情，查看流程图追踪。
11. 进入「审计日志」，查询初始化、流程启动、任务完成等记录。

## 常用入口

- 首页：查看后端状态、演示数据状态、任务和连接器摘要。
- 快速开始：按步骤跑通演示流程。
- 流程模型：查看、校验、部署、导出模型。
- 流程设计器：编辑 BPMN 草稿和基础节点属性。
- 我的任务：处理待办、查看已办和我发起的流程。
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
