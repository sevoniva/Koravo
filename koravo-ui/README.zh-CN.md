# Koravo UI

Koravo UI 是 Koravo 工作流运维控制台前端。当前前端以官方 Ant Design Pro V6 模板为基线，保留 ProLayout、Umi Max、antd、ProComponents 的工程约定。

## 技术栈

- React 19
- Umi Max 4
- antd 6
- Ant Design ProComponents 3
- UtooPack
- TypeScript
- Biome
- Vitest

## 本地开发

```bash
npm install
npm run dev
```

开发服务会把 `/api/` 代理到 `http://localhost:8080`。后端开发鉴权使用请求头：

- `X-Tenant-Id`: `default`
- `X-User-Id`: `admin`

前端运行时会自动带上这两个值，除非本地会话配置被改写。

## 提交前检查

```bash
npm run lint
npm exec -- antd lint ./src --format json --lang zh
npm run build
```

`npm test` 使用 Vitest。新增行为时补充聚焦测试。

## Ant Design 约束

- 优先使用官方 antd 和 ProComponents，不新增自造 UI 基础组件。
- 新增 antd 用法前，先用 `npm exec -- antd info <Component> --format json --lang zh` 查组件 API。
- 顶栏、侧边栏、菜单、面包屑和页面容器沿用官方 ProLayout 体系。
- 不重新引入模板样例页面、样例服务生成物或无用模板资产。
