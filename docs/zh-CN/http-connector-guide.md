# HTTP Connector 指南

## 配置 Service Task

进入「流程设计器」，选择 Service Task。

填写：

- Delegate expression：`${koravoConnectorDelegate}`
- 连接器类型：`http`
- 请求方法：`GET` 或 `POST`
- URL：目标地址
- 请求头 JSON：例如 `{}`
- 请求体：POST 时填写
- 超时毫秒：例如 `5000`
- 输出变量：例如 `connectorResult`

点击「应用」，再保存草稿并部署。

## 查看执行日志

进入「运维中心」的「连接器日志」页签。

可按连接器类型、状态、请求 ID 查询。

点击「查看」可查看请求、响应和错误信息。

## 安全边界

HTTP Connector 会经过 URL 访问策略检查。敏感字段如 password、token、secret 会在日志中脱敏。
