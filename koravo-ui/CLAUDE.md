# Koravo UI

Koravo UI uses the official Ant Design Pro V6 stack:

- React 19
- Umi Max 4
- antd 6
- ProComponents 3
- UtooPack
- TypeScript
- Biome

Before editing antd code, query the exact component API:

```bash
npm exec -- antd info <Component> --format json --lang zh
```

Before committing:

```bash
npm run lint
npm exec -- antd lint ./src --format json --lang zh
npm run build
```

Business services live in `src/services/koravo`. Layout, menu, breadcrumbs, settings drawer, and page containers should stay within official Ant Design Pro conventions.
