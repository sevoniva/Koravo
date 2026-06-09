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
curl -H 'X-Tenant-Id: default' -H 'X-User-Id: admin' -H 'X-User-Role: admin' \
  http://localhost:8080/api/v1/health
```

## 启动前端

```bash
cd koravo-ui
npm install
npm run dev
```

打开 `http://localhost:8000`。

## 跑通多人验收流程

1. 进入「流程模型」确认「多人验收流程」已完成发布检查并部署。
2. 进入「表单管理」，维护「验收申请表」字段、必填规则、选项和控件类型。
3. 进入「表单绑定」，分别绑定启动表单、业务验收任务表单和财务验收任务表单。
4. 进入「发起流程」，选择「多人验收流程」，填写验收事项、验收标准、金额和处理人。
5. 进入「我的待办」，由业务处理人和财务复核人分别处理并行任务。
6. 回到「流程实例」打开实例详情，查看启动表单、任务表单、当前任务、执行轨迹和审计记录。
7. 进入「审计日志」，按实例编号或追踪号查询流程启动、任务完成等关键操作。

## 常用入口

- 总览：查看服务状态、流程配置状态、任务和连接器摘要。
- 工作台：处理我的待办，查看经办记录和我发起的流程。
- 流程中心：发起流程，查看流程实例和运行状态。
- 流程设计：创建、导入和编辑 BPMN 流程。
- 流程模型：查看、校验、部署、导出模型。
- 组织权限：查看平台同步的用户、部门、角色和流程办理权限。
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
