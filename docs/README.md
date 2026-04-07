# Veil Docs

Nextra-based documentation site for Veil.

## Requirements

- Node.js 20+
- Yarn 1.x or npm

## Local Development

```bash
cd docs
yarn install
yarn dev
```

The site runs at `http://localhost:3000`.

## Production Build

```bash
cd docs
yarn build
yarn start
```

## Content Layout

- `pages/` contains MDX docs and `_meta.ts` navigation files
- `public/` contains static assets
- `theme.config.tsx` configures the Nextra docs theme

## Deploying

The site is ready to deploy to any Next.js-compatible host such as Vercel.

Recommended flow:

1. Connect the repository to your host.
2. Set the project root to `docs/`.
3. Use the default build command: `next build`.
4. Use the default start command: `next start`.

## Updating Docs

- Add new pages under `pages/`
- Keep navigation order in the nearest `_meta.ts`
- Prefer updating docs alongside code changes in `program/`, `sdk/`, and `coordinator/`
