import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { VeilClient, getVaultPda, getSchedulePda, buildMerkleTree } from "@veil/sdk";
import {
    getConnection,
    getDefaultWallet,
    USDC_DEVNET,
    printSeparator,
    formatPubkey,
    waitForConfirmation,
    COORDINATOR_API,
} from "./helpers";

async function main() {
    printSeparator("Example 5: Full End-to-End Flow");

    const connection = getConnection();
    const wallet = getDefaultWallet();
    const client = new VeilClient({ connection, wallet });

    console.log(`\nSetup:`);
    console.log(`   Wallet: ${formatPubkey(wallet.publicKey)}`);
    console.log(`   Token Mint: ${formatPubkey(USDC_DEVNET)}`);
    console.log(`   Coordinator API: ${COORDINATOR_API}`);

    printSeparator("Step 1: Initialize Vault");
    let vault = await client.getVault();

    if (!vault) {
        console.log(`\nInitializing vault...`);
        const signature = await client.initVault(USDC_DEVNET);
        console.log(`   Vault initialized: ${signature}`);
        await waitForConfirmation(connection, signature);
        vault = await client.getVault();
    } else {
        const [vaultPda] = getVaultPda(wallet.publicKey);
        console.log(`   Vault already exists: ${formatPubkey(vaultPda)}`);
    }

    if (!vault) {
        throw new Error("Failed to get vault after initialization");
    }

    console.log(`   Available: ${vault.available.toString()} (${vault.available.toNumber() / 1_000_000} USDC)`);
    console.log(`   Reserved: ${vault.reserved.toString()} (${vault.reserved.toNumber() / 1_000_000} USDC)`);

    printSeparator("Step 2: Deposit Tokens");
    const requiredAmount = new BN(10_000_000);

    if (vault.available.lt(requiredAmount)) {
        console.log(`\nInsufficient vault balance.`);
        console.log(`   Required: ${requiredAmount.toString()} (${requiredAmount.toNumber() / 1_000_000} USDC)`);
        console.log(`   Available: ${vault.available.toString()} (${vault.available.toNumber() / 1_000_000} USDC)`);
        console.log(`\nPlease deposit tokens first (run 02-deposit.ts) or modify this script to deposit.`);
        console.log(`   Skipping deposit step for now...`);
    } else {
        console.log(`   Sufficient balance available`);
    }

    printSeparator("Step 3: Create Schedule");

    const recipients = [
        {
            address: new PublicKey("11111111111111111111111111111111"),
            amount: 100_000n,
        },
        {
            address: new PublicKey("22222222222222222222222222222222"),
            amount: 200_000n,
        },
        {
            address: new PublicKey("33333333333333333333333333333333"),
            amount: 300_000n,
        },
    ];

    console.log(`\nCreating schedule with ${recipients.length} recipients...`);
    recipients.forEach((r, i) => {
        console.log(`   ${i + 1}. ${formatPubkey(r.address)}: ${r.amount / 1_000_000n} USDC`);
    });

    const totalAmount = recipients.reduce((sum, r) => sum + r.amount, 0n);
    const perExecutionAmount = new BN(totalAmount.toString());
    const reservedAmount = perExecutionAmount.mul(new BN(10));

    console.log(`\nSchedule Parameters:`);
    console.log(`   Per Execution: ${perExecutionAmount.toString()} (${perExecutionAmount.toNumber() / 1_000_000} USDC)`);
    console.log(`   Reserved: ${reservedAmount.toString()} (${reservedAmount.toNumber() / 1_000_000} USDC)`);
    console.log(`   Interval: 3600 seconds (1 hour)`);

    const { signature, scheduleId, merkleRoot } = await client.createScheduleFromRecipients({
        recipients,
        intervalSecs: 3600,
        reservedAmount,
        perExecutionAmount,
    });

    console.log(`\nSchedule created!`);
    console.log(`   Transaction: ${signature}`);
    console.log(`   Schedule ID: ${Buffer.from(scheduleId).toString("hex")}`);

    await waitForConfirmation(connection, signature);

    const [vaultPda] = getVaultPda(wallet.publicKey);
    const [schedulePda] = getSchedulePda(vaultPda, scheduleId);
    console.log(`   Schedule PDA: ${schedulePda.toString()}`);

    printSeparator("Step 4: Register with Coordinator");

    console.log(`\nRegistering schedule with coordinator...`);

    try {
        const { proofs } = buildMerkleTree(recipients);

        const requestBody = {
            schedulePda: schedulePda.toString(),
            scheduleId: scheduleId,
            vaultEmployer: wallet.publicKey.toString(),
            tokenMint: USDC_DEVNET.toString(),
            recipients: recipients.map((r) => ({
                address: r.address.toString(),
                amount: r.amount.toString(),
            })),
        };

        const response = await fetch(`${COORDINATOR_API}/api/schedules`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const error = await response.json() as { error?: string };
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        const result = await response.json() as { merkleRoot: number[] };
        console.log(`\nSchedule registered with coordinator!`);
        console.log(`   Merkle Root: ${Buffer.from(result.merkleRoot).toString("hex")}`);
    } catch (error: any) {
        console.error(`\nError registering with coordinator:`, error.message);
        if (error.message.includes("ECONNREFUSED")) {
            console.error(`\nMake sure the coordinator is running:`);
            console.error(`   cd coordinator && yarn dev`);
        }
        throw error;
    }

    printSeparator("Summary");
    console.log(`\nFull flow completed successfully!`);
    console.log(`\nSummary:`);
    console.log(`   Vault PDA: ${formatPubkey(vaultPda)}`);
    console.log(`   Schedule PDA: ${schedulePda.toString()}`);
    console.log(`   Schedule ID: ${Buffer.from(scheduleId).toString("hex")}`);
    console.log(`   Recipients: ${recipients.length}`);
    console.log(`   Per Execution: ${perExecutionAmount.toNumber() / 1_000_000} USDC`);
    console.log(`\nNext Steps:`);
    console.log(`   1. Coordinator will monitor the schedule`);
    console.log(`   2. When next_execution time arrives, coordinator will:`);
    console.log(`      - Delegate schedule to ER`);
    console.log(`      - Execute claim_payment for each recipient`);
    console.log(`      - Commit state back to Solana`);
    console.log(`   3. Check coordinator logs to see execution progress`);
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
