# Veil - Private Payments on Solana

Private payment protocol for Solana using MagicBlock Ephemeral Rollups (ER) for privacy-preserving scheduled payments.

## Overview

Veil enables private, scheduled payments where recipient lists and amounts are hidden using Merkle trees and executed privately in TEE (Trusted Execution Environment) via MagicBlock ER.

**Key Features:**

- Private recipient lists (Merkle tree-based)
- Scheduled recurring payments
- ER-based execution for privacy
- On-chain settlement layer

## Project Structure

```
veil/
├── program/          # Anchor program (Solana smart contract)
├── sdk/              # TypeScript SDK for interacting with the protocol
├── coordinator/      # Execution service (monitors & executes schedules)
└── examples/        # Step-by-step examples and tests
```

## Quick Start

### 1. Install SDK

```bash
cd sdk
yarn install
yarn build
```

### 2. Run Examples

```bash
cd examples
yarn install
yarn 01-init-vault
yarn 02-deposit 10000000
yarn 03-create-schedule
```

### 3. Start Coordinator

```bash
cd coordinator
yarn install
yarn dev
```

## Documentation

- **[SDK Documentation](sdk/Docs.md)** - Complete SDK API reference and usage
- **[Coordinator Guide](coordinator/README.md)** - Setup and configuration
- **[Examples](examples/README.md)** - Step-by-step examples and testing guide

## Architecture

```
┌─────────────┐
│   Solana    │  ← Settlement layer (on-chain)
│  Base Layer │  ← Vaults, schedules, Merkle roots
└─────────────┘
       ↓
┌─────────────┐
│  ER Layer   │  ← Execution (private in TEE)
│   (TEE)     │  ← Claim payments, hide recipients
└─────────────┘
       ↓
┌─────────────┐
│ Coordinator │  ← Automation service
│  (Server)   │  ← Monitors, delegates, executes
└─────────────┘
```

## Development

### Prerequisites

- Node.js, Yarn
- Solana CLI
- Rust & Anchor (for program development)

### Setup

```bash
# Install dependencies
cd program && yarn install
cd ../sdk && yarn install
cd ../coordinator && yarn install
cd ../examples && yarn install

# Build
cd program && anchor build
cd ../sdk && yarn build
cd ../coordinator && yarn build
```

### Testing

```bash
# Program tests
cd program
anchor test

# Examples (integration tests)
cd examples
yarn 05-full-flow
```

## License

MIT
