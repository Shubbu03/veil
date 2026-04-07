# Contributing to Veil

## Scope

This repository contains the on-chain program, TypeScript SDK, coordinator service, and documentation site for Veil.

## Setup

### Program

```bash
cd program
yarn install
anchor build
anchor test
```

### SDK

```bash
cd sdk
npm install
npm run build
```

### Coordinator

```bash
cd coordinator
npm install
npm run build
```

### Docs

```bash
cd docs
yarn install
yarn dev
```

## Contribution Guidelines

1. Keep changes scoped to a clear feature, fix, or documentation update.
2. Update docs when behavior, APIs, or setup steps change.
3. Prefer small pull requests with clear commit messages.
4. Add or update tests when changing program, SDK, or coordinator behavior.
5. Do not commit secrets, funded keypairs, or environment-specific credentials.

## Pull Requests

Include:

- what changed
- why it changed
- how it was tested
- any follow-up work still pending

## Reporting Issues

When opening an issue, include:

- affected package or folder
- expected behavior
- actual behavior
- reproduction steps
- logs or screenshots when relevant
