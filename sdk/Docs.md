# Veil SDK Documentation

Private payments protocol SDK for Solana.

---

## Installation

```bash
npm install @veil/sdk
# or
yarn add @veil/sdk
```

---

## Quick Start

```typescript
import { Connection, Keypair } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { VeilClient } from "@veil/sdk";

// Setup
const connection = new Connection("https://api.devnet.solana.com");
const keypair = Keypair.fromSecretKey(/* your secret key */);
const wallet = new Wallet(keypair);

const client = new VeilClient({ connection, wallet });
```

---

## Vault Operations

### Initialize Vault

Create a vault for your wallet. Each wallet can have one vault per token mint.

```typescript
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

const signature = await client.initVault(USDC_MINT);
console.log("Vault created:", signature);
```

### Deposit Tokens

Deposit tokens from your wallet into the vault.

```typescript
const amount = new BN(1_000_000); // 1 USDC (6 decimals)

const signature = await client.deposit(amount, USDC_MINT);
console.log("Deposited:", signature);
```

### Withdraw Tokens

Withdraw available (non-reserved) tokens from the vault.

```typescript
const amount = new BN(500_000); // 0.5 USDC

const signature = await client.withdraw(amount, USDC_MINT);
console.log("Withdrawn:", signature);
```

### Get Vault State

```typescript
const vault = await client.getVault();

if (vault) {
  console.log("Available:", vault.available.toString());
  console.log("Reserved:", vault.reserved.toString());
  console.log("Token Mint:", vault.tokenMint.toString());
}
```

---

## Schedule Operations

### Create Schedule (Simple)

Use `createScheduleFromRecipients` for automatic merkle tree generation.

```typescript
import { PublicKey } from "@solana/web3.js";

const recipients = [
  { address: new PublicKey("recipient1..."), amount: 100_000n },
  { address: new PublicKey("recipient2..."), amount: 200_000n },
  { address: new PublicKey("recipient3..."), amount: 200_000n },
];

const { signature, scheduleId, merkleRoot } =
  await client.createScheduleFromRecipients({
    recipients,
    intervalSecs: 86400, // Daily (24 hours)
    reservedAmount: new BN(10_000_000), // Total reserved: 10 USDC
    perExecutionAmount: new BN(500_000), // Per cycle: 0.5 USDC
  });

console.log("Schedule created:", signature);
console.log("Schedule ID:", scheduleId);
```

### Create Schedule (Advanced)

For manual control over schedule parameters.

```typescript
import { generateScheduleId, buildMerkleTree } from "@veil/sdk";

// Generate IDs
const scheduleId = generateScheduleId();
const erJobId = generateScheduleId();

// Build merkle tree manually
const recipients = [
  { address: pubkey1, amount: 100_000n },
  { address: pubkey2, amount: 200_000n },
];
const { root, proofs } = buildMerkleTree(recipients);

// Create schedule
const signature = await client.createSchedule({
  scheduleId,
  intervalSecs: 86400,
  reservedAmount: new BN(10_000_000),
  perExecutionAmount: new BN(500_000),
  merkleRoot: Array.from(root),
  totalRecipients: recipients.length,
  erJobId,
});
```

### Pause Schedule

```typescript
import { getVaultPda, getSchedulePda } from "@veil/sdk";

const [vaultPda] = getVaultPda(wallet.publicKey);
const [schedulePda] = getSchedulePda(vaultPda, scheduleId);

// Pause
await client.pauseSchedule(schedulePda, true);

// Resume
await client.pauseSchedule(schedulePda, false);
```

### Cancel Schedule

Cancelling returns reserved funds to available balance.

```typescript
await client.cancelSchedule(schedulePda);
```

### Get Schedule State

```typescript
const schedule = await client.getSchedule(schedulePda);

if (schedule) {
  console.log("Status:", schedule.status);
  console.log("Next Execution:", schedule.nextExecution.toString());
  console.log("Reserved:", schedule.reservedAmount.toString());
  console.log("Recipients:", schedule.totalRecipients);
}
```

---

## PDA Helpers

Derive program addresses without making RPC calls.

```typescript
import {
  PROGRAM_ID,
  getConfigPda,
  getVaultPda,
  getVaultAtaPda,
  getSchedulePda,
} from "@veil/sdk";

// Global config
const [configPda] = getConfigPda();

// Vault for an employer
const [vaultPda, vaultBump] = getVaultPda(employerPubkey);

// Vault's token account
const [vaultAtaPda] = getVaultAtaPda(vaultPda);

// Schedule
const [schedulePda] = getSchedulePda(vaultPda, scheduleId);
```

---

## Claim Payment

### Claim Payment (For Coordinator/ER Authority)

Claim a payment on behalf of a recipient. This requires ER authority to sign.

```typescript
import { getProofForRecipient, findRecipientIndex } from "@veil/sdk";

// Get proof for recipient
const recipients = [
  { address: recipientPubkey, amount: 100_000n },
  // ... other recipients
];
const recipientIndex = findRecipientIndex(recipients, recipientPubkey);
const proof = getProofForRecipient(recipients, recipientIndex);

if (proof) {
  const signature = await client.claimPayment(
    erAuthorityWallet, // ER authority wallet (must sign)
    vaultEmployerPubkey, // Employer who owns the vault
    scheduleId, // Schedule ID
    recipientPubkey, // Recipient address
    new BN(100_000), // Amount
    proof.leafIndex, // Leaf index
    proof.proof.map((p) => Array.from(p)), // Convert proof to number[][]
    tokenMint
  );
}
```

### Get Proof for Recipient

Helper to get merkle proof for a specific recipient:

```typescript
import { getProofForRecipient, findRecipientIndex } from "@veil/sdk";

const recipients = [
  { address: pubkey1, amount: 100_000n },
  { address: pubkey2, amount: 200_000n },
];

// Find index by address
const index = findRecipientIndex(recipients, pubkey1);

// Get proof
const proof = getProofForRecipient(recipients, index);

if (proof) {
  console.log("Leaf Index:", proof.leafIndex);
  console.log(
    "Proof:",
    proof.proof.map((p) => Array.from(p))
  );
}
```

---

## Merkle Tree

Build and verify merkle proofs for recipient lists.

### Build Tree

```typescript
import { buildMerkleTree, Recipient } from "@veil/sdk";

const recipients: Recipient[] = [
  { address: pubkey1, amount: 100_000n },
  { address: pubkey2, amount: 200_000n },
  { address: pubkey3, amount: 150_000n },
];

const { root, proofs } = buildMerkleTree(recipients);

// root: Buffer (32 bytes) - store on-chain
// proofs: array of { leafIndex, proof } for each recipient
```

### Verify Proof

```typescript
import { verifyProof, hashLeaf } from "@veil/sdk";

const leaf = hashLeaf(recipientPubkey, amount);
const isValid = verifyProof(leaf, proof, leafIndex, root);
```

### Convert for On-Chain

```typescript
// Merkle root as number array (for instruction)
const merkleRootArray = Array.from(root);

// Proof as array of number arrays
const proofArrays = proofs[0].proof.map((p) => Array.from(p));
```

---

## Types

```typescript
import {
  VaultAccount,
  ScheduleAccount,
  VeilConfig,
  ScheduleStatus,
  CreateScheduleParams,
} from "@veil/sdk";

// ScheduleStatus enum
ScheduleStatus.Active;
ScheduleStatus.Paused;
ScheduleStatus.Cancelled;
```

---

## Config

Get global protocol configuration.

```typescript
const config = await client.getConfig();

if (config) {
  console.log("Allowed Mint:", config.allowedMint.toString());
  console.log("Max Recipients:", config.maxRecipients);
  console.log("Paused:", config.paused);
}
```

---

## Error Handling

```typescript
try {
  await client.deposit(amount, tokenMint);
} catch (error) {
  // Anchor errors include error code
  if (error.message.includes("InsufficientFunds")) {
    console.log("Not enough tokens");
  } else if (error.message.includes("Paused")) {
    console.log("Protocol is paused");
  }
}
```

---

## Full Example

```typescript
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Wallet, BN } from "@coral-xyz/anchor";
import { VeilClient, getVaultPda, getSchedulePda } from "@veil/sdk";

async function main() {
  // Setup
  const connection = new Connection("https://api.devnet.solana.com");
  const keypair = Keypair.generate(); // Use your keypair
  const wallet = new Wallet(keypair);
  const client = new VeilClient({ connection, wallet });

  const USDC = new PublicKey("...");

  // 1. Create vault
  await client.initVault(USDC);

  // 2. Deposit funds
  await client.deposit(new BN(10_000_000), USDC);

  // 3. Create payment schedule
  const { scheduleId } = await client.createScheduleFromRecipients({
    recipients: [
      { address: new PublicKey("..."), amount: 100_000n },
      { address: new PublicKey("..."), amount: 100_000n },
    ],
    intervalSecs: 86400,
    reservedAmount: new BN(2_000_000),
    perExecutionAmount: new BN(200_000),
  });

  // 4. Check vault state
  const vault = await client.getVault();
  console.log("Available:", vault?.available.toString());
  console.log("Reserved:", vault?.reserved.toString());

  // 5. Get schedule
  const [vaultPda] = getVaultPda(wallet.publicKey);
  const [schedulePda] = getSchedulePda(vaultPda, scheduleId);
  const schedule = await client.getSchedule(schedulePda);
  console.log("Schedule status:", schedule?.status);
}

main();
```

---

## Development

```bash
# Install dependencies
yarn install

# Build SDK
yarn build

# Sync IDL after program changes
yarn sync-idl
```
