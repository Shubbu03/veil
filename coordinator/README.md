# Veil Coordinator

MagicBlock ER execution coordinator service for Veil private payments.

## Overview

The coordinator monitors payment schedules and executes them via MagicBlock Ephemeral Rollups (ER) for privacy.

**Flow:**

1. Polls Solana for schedules due for execution
2. Delegates schedule to ER
3. Executes `claim_payment` for each recipient (private in TEE)
4. Commits state back to Solana
5. Undelegates schedule

## Setup

```bash
cd coordinator
yarn install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
SOLANA_RPC_URL=https://api.devnet.solana.com
ER_RPC_URL=https://devnet.magicblock.app
ER_VALIDATOR=MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd
ER_AUTHORITY_KEYPAIR_PATH=./er-authority-keypair.json
PORT=3001
POLL_INTERVAL_MS=60000
```

**Available ER Validators:**

- **US:** `MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd` (devnet-us.magicblock.app)
- **EU:** `MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e` (devnet-eu.magicblock.app)
- **Asia:** `MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57` (devnet-as.magicblock.app)
- **TEE:** `FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA` (tee.magicblock.app)

## Usage

### Development

```bash
yarn dev
```

### Production

```bash
yarn build
yarn start
```

## API Endpoints

### Register Schedule

When a schedule is created, register recipient data:

```bash
POST /api/schedules
Content-Type: application/json

{
  "schedulePda": "schedule_pubkey_here",
  "scheduleId": [1, 2, 3, ...],  // 32 bytes
  "vaultEmployer": "employer_pubkey_here",
  "tokenMint": "USDC_mint_address",
  "recipients": [
    { "address": "recipient1_pubkey", "amount": "100000" },
    { "address": "recipient2_pubkey", "amount": "200000" }
  ]
}
```

### Get Schedule

```bash
GET /api/schedules/:schedulePda
```

### Health Check

```bash
GET /api/health
```

## Architecture

```
┌─────────────┐
│   Solana    │  ← Poll for due schedules
│  Base Layer │  ← Delegate schedule PDA
└─────────────┘  ← Commit final state
       ↓
┌─────────────┐
│  ER Layer   │  ← Execute claim_payment (private)
│   (TEE)     │  ← Multiple recipients
└─────────────┘
```

## Implementation Status

- [x] ER RPC connection configured
- [x] ER transaction submission implemented
- [x] Claim execution on ER
- [x] Commit state to Solana
- [ ] Retry logic for failed claims (partial - continues on error)
- [ ] Database for job tracking (currently in-memory)
- [ ] Monitoring/logging (basic console logs)
- [ ] Rate limiting
