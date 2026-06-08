# Koravo UI Agent Notes

This package is an official Ant Design Pro V6 based React app for Koravo.

## Commands

- `npm run dev`: start Umi Max development server with backend proxy.
- `npm run lint`: run Biome and TypeScript checks.
- `npm exec -- antd lint ./src --format json --lang zh`: run antd-specific usage checks.
- `npm run build`: build production assets with UtooPack.
- `npm test`: run Vitest.

## Rules

- Use official antd, ProComponents, and ProLayout patterns first.
- Check component APIs with `npm exec -- antd info <Component> --format json --lang zh` before adding or changing antd component usage.
- Keep route, menu, breadcrumb, and layout behavior in `config/routes.ts` and `src/app.tsx`.
- Keep Koravo API access in `src/services/koravo`.
- Do not add generated sample pages, sample services, or unused template assets.
- Commit only after fresh `npm run lint`, antd lint, and `npm run build` evidence.
