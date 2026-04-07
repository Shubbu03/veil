# Veil

Private, scheduled payments protocol for Solana using MagicBlock Ephemeral Rollups (ER).

This repository contains:

- `program/` - Anchor program for vaults, schedules, claims, and ER settlement
- `sdk/` - published TypeScript SDK at `@veil-dev/sdk`
- `coordinator/` - scheduler and REST service for off-chain execution
- `docs/` - Nextra documentation site

All documentation, guides, and API references live in the docs site.

## Local Docs

See [docs/README.md](docs/README.md) for local development, build, and deployment notes.

```bash
cd docs
yarn install
yarn dev
# then open http://localhost:3000
```

## Repository Guide

If you are browsing this repository, use the docs as the primary source of truth for:

- How the protocol works
- SDK usage and examples
- Coordinator setup and APIs

## Development

- Program tests: `cd program && anchor test`
- SDK build: `cd sdk && npm run build`
- Coordinator build: `cd coordinator && npm run build`
- Docs build: `cd docs && npm run build`

## Open Source

- Contributing: [CONTRIBUTING.md](CONTRIBUTING.md)
- License: [LICENSE](LICENSE)
