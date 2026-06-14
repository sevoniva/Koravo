# Koravo UI

Koravo UI is the React console for Koravo workflow operations. It is based on the official Ant Design Pro V6 template and keeps the ProLayout, Umi Max, antd, and ProComponents conventions as the frontend foundation.

## Stack

- React 19
- Umi Max 4
- antd 6
- Ant Design ProComponents 3
- UtooPack
- TypeScript
- Biome
- Vitest

## Development

```bash
npm install
npm run dev
```

The development server proxies `/api/` to `http://localhost:8080`. The backend expects development headers:

- `X-Tenant-Id`: `default`
- `X-User-Id`: `admin`

The runtime sets these values automatically unless they are changed in local session storage.

## Quality Gates

Run these commands before committing frontend changes:

```bash
npm run lint
npm exec -- antd lint ./src --format json --lang zh
npm run build
```

`npm test` is available through Vitest. Add focused tests with new behavior.

## Ant Design Rules

- Use official antd and ProComponents before creating local UI primitives.
- Check component APIs with `npm exec -- antd info <Component> --format json --lang zh` before adding new antd usage.
- Keep layout inside the official ProLayout route and menu system.
- Do not reintroduce generated sample pages, generated sample services, or unused template assets.
