# Veil Examples

Step-by-step examples demonstrating how to use Veil for private payments on Solana.

## Overview

These examples walk you through the complete flow of using Veil:

1. **Initialize Vault** - Create a vault for your wallet
2. **Deposit Tokens** - Add tokens to your vault
3. **Create Schedule** - Set up a payment schedule with recipients
4. **Register with Coordinator** - Register schedule for automatic execution
5. **Full Flow** - Complete end-to-end example

## Prerequisites

1. **Node.js** and **yarn** installed
2. **Solana CLI** installed and configured
3. **Wallet** with SOL for transaction fees
4. **USDC Devnet tokens** (for deposits)
5. **Coordinator running** (for examples 4 and 5)

## Setup

```bash
cd examples
yarn install
```

## Configuration

Set environment variables (optional):

```bash
export COORDINATOR_API=http://localhost:3001  # Default coordinator URL
```

## Examples

### 1. Initialize Vault

Create a vault for your wallet. Each wallet can have one vault per token mint.

```bash
yarn 01-init-vault
# or
ts-node 01-init-vault.ts
```

**What it does:**

- Creates a vault PDA for your wallet
- Sets up a token account for the vault
- Verifies vault creation

**Output:**

- Vault PDA address
- Transaction signature
- Explorer link

---

### 2. Deposit Tokens

Deposit tokens into your vault.

```bash
yarn 02-deposit [amount]
# or
ts-node 02-deposit.ts 1000000  # Deposit 1 USDC (6 decimals)
```

**What it does:**

- Checks vault exists
- Verifies you have sufficient USDC balance
- Deposits tokens to vault
- Updates vault balance

**Parameters:**

- `amount` (optional): Amount in smallest unit (default: 1,000,000 = 1 USDC)

**Note:** You need USDC devnet tokens. Get them from a faucet or mint them if you have authority.

---

### 3. Create Schedule

Create a payment schedule with recipients.

```bash
yarn 03-create-schedule
# or
ts-node 03-create-schedule.ts
```

**What it does:**

- Creates a schedule with multiple recipients
- Builds Merkle tree for privacy
- Reserves funds for payments
- Sets execution interval

**Output:**

- Schedule PDA address
- Schedule ID
- Merkle root
- Transaction signature

**Save this information** - you'll need it for the next step!

---

### 4. Register with Coordinator

Register your schedule with the coordinator service for automatic execution.

```bash
yarn 04-register <schedulePda> <scheduleId> <vaultEmployer>
# or
ts-node 04-register-with-coordinator.ts \
  "SchedulePDA..." \
  "[1,2,3,...]" \
  "EmployerPubkey..."
```

**What it does:**

- Sends recipient data to coordinator API
- Registers schedule for monitoring
- Verifies registration

**Prerequisites:**

- Coordinator must be running (`cd coordinator && yarn dev`)
- Schedule must exist on-chain

---

### 5. Full Flow

Complete end-to-end example combining all steps.

```bash
yarn 05-full-flow
# or
ts-node 05-full-flow.ts
```

**What it does:**

- Runs all steps in sequence
- Handles existing vaults/schedules
- Provides complete summary

**Prerequisites:**

- Coordinator must be running
- Wallet must have SOL for fees
- USDC tokens (or modify script)

---

## Running All Examples

Run examples in sequence:

```bash
yarn all
```

Or run individually:

```bash
yarn 01-init-vault
yarn 02-deposit 1000000
yarn 03-create-schedule
# Then copy the schedule info and run:
yarn 04-register "SchedulePDA" "[scheduleId]" "EmployerPubkey"
```

---

## Testing the Complete Flow

### Step 1: Start Coordinator

```bash
cd ../coordinator
yarn dev
```

Keep this running in a separate terminal.

### Step 2: Run Examples

In another terminal:

```bash
cd examples
yarn 01-init-vault      # Create vault
yarn 02-deposit 10000000  # Deposit 10 USDC
yarn 03-create-schedule  # Create schedule
```

Copy the schedule information from step 3, then:

```bash
yarn 04-register "SchedulePDA" "[scheduleId]" "EmployerPubkey"
```

### Step 3: Monitor Execution

Watch the coordinator logs. When `next_execution` time arrives, the coordinator will:

1. Delegate schedule to ER
2. Execute `claim_payment` for each recipient
3. Commit state back to Solana

---

## Troubleshooting

### "Vault not found"

Run `01-init-vault.ts` first.

### "Insufficient balance"

Deposit tokens using `02-deposit.ts` or get USDC from a faucet.

### "ECONNREFUSED" when registering

Make sure coordinator is running:

```bash
cd coordinator && yarn dev
```

### "Schedule not found"

Make sure you're using the correct schedule PDA and it exists on-chain.

### Transaction failures

- Check your wallet has SOL for fees
- Verify you're on devnet
- Check program is deployed

---

## Customization

### Using Different Recipients

Edit the recipients array in examples 3, 4, and 5:

```typescript
const recipients = [
  {
    address: new PublicKey("YourRecipientAddress1"),
    amount: 100_000n, // 0.1 USDC
  },
  // Add more recipients...
];
```

### Using Different Token Mint

Change the `USDC_DEVNET` constant in `helpers.ts` or pass a different mint.

### Adjusting Schedule Parameters

Modify in examples 3 and 5:

- `intervalSecs`: Time between executions (in seconds)
- `reservedAmount`: Total amount to reserve
- `perExecutionAmount`: Amount paid per execution

---

## Next Steps

After running these examples:

1. **Monitor schedules** - Check coordinator logs
2. **Verify payments** - Check recipient token accounts
3. **Explore SDK** - See `sdk/Docs.md` for full API reference
4. **Build your app** - Use these examples as templates

---

## Support

For issues or questions:

- Check [`sdk/Docs.md`](../sdk/Docs.md) for SDK documentation
- Review [`coordinator/README.md`](../coordinator/README.md) for coordinator setup
- Check program tests in `program/tests/`
