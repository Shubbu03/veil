@veil-dev/sdk
================

TypeScript/JavaScript SDK for interacting with the **Veil** protocol on Solana, including helpers for:

- Building and verifying Merkle trees for recipient lists
- Deriving PDAs used by the Veil program
- High-level client utilities for working with schedules and vaults

> For full protocol, coordinator, and advanced SDK docs, see the main Veil documentation site referenced in the root `README.md` of this repo.

Basic usage
-----------

```ts
import { PublicKey } from "@solana/web3.js";
import { buildMerkleTree, Recipient } from "@veil-dev/sdk";

const recipients: Recipient[] = [
  { address: new PublicKey("..."), amount: 1000n },
  { address: new PublicKey("..."), amount: 2000n },
];

const { root, proofs } = buildMerkleTree(recipients);
console.log("Merkle root:", root.toString("hex"));
```

Repository & docs
-----------------

- Source: see the `sdk/` directory in the main Veil repository.
- Docs: refer to the Veil docs site (linked from the root `README.md`) for:
  - Full API reference
  - End-to-end examples
  - Coordinator integration guides

