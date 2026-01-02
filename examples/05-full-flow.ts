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

    printSeparator("Step 1: Initialize Vault");
    let vault = await client.getVault();

    if (!vault) {
        const signature = await client.initVault(USDC_DEVNET);
        await waitForConfirmation(connection, signature);
        vault = await client.getVault();
    }

    if (!vault) {
        throw new Error("Failed to get vault after initialization");
    }

    printSeparator("Step 2: Deposit Tokens");
    const requiredAmount = new BN(10_000_000);

    if (vault.available.lt(requiredAmount)) {
        console.error("Insufficient vault balance");
        process.exit(1);
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

    const totalAmount = recipients.reduce((sum, r) => sum + r.amount, 0n);
    const perExecutionAmount = new BN(totalAmount.toString());
    const reservedAmount = perExecutionAmount.mul(new BN(10));

    const { signature, scheduleId } = await client.createScheduleFromRecipients({
        recipients,
        intervalSecs: 3600,
        reservedAmount,
        perExecutionAmount,
    });

    await waitForConfirmation(connection, signature);

    const [vaultPda] = getVaultPda(wallet.publicKey);
    const [schedulePda] = getSchedulePda(vaultPda, scheduleId);

    printSeparator("Step 4: Register with Coordinator");

    try {
        buildMerkleTree(recipients);

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
    } catch (error: any) {
        console.error("Error registering with coordinator:", error.message);
        if (error.message.includes("ECONNREFUSED")) {
            console.error("Make sure the coordinator is running: cd coordinator && yarn dev");
        }
        throw error;
    }
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
