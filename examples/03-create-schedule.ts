import { BN } from "@coral-xyz/anchor";
import { VeilClient, getVaultPda, getSchedulePda } from "@veil/sdk";
import {
    getConnection,
    getDefaultWallet,
    USDC_DEVNET,
    printSeparator,
    formatPubkey,
    waitForConfirmation,
} from "./helpers";

async function main() {
    printSeparator("Example 3: Create Payment Schedule");

    const connection = getConnection();
    const wallet = getDefaultWallet();
    const client = new VeilClient({ connection, wallet });

    const vault = await client.getVault();
    if (!vault) {
        console.error("Vault not found! Please run 01-init-vault.ts first.");
        process.exit(1);
    }
    const [vaultPda] = getVaultPda(wallet.publicKey);

    const recipients = [
        {
            address: wallet.publicKey,
            amount: 100_000n,
        },
        {
            address: wallet.publicKey,
            amount: 200_000n,
        },
        {
            address: wallet.publicKey,
            amount: 300_000n,
        },
    ];

    const totalAmount = recipients.reduce((sum, r) => sum + r.amount, 0n);
    const perExecutionAmount = new BN(totalAmount.toString());
    const reservedAmount = perExecutionAmount.mul(new BN(10));

    if (vault.available.lt(reservedAmount)) {
        console.error("Insufficient vault balance");
        process.exit(1);
    }

    try {
        const { signature, scheduleId } = await client.createScheduleFromRecipients({
            recipients,
            intervalSecs: 3600,
            reservedAmount,
            perExecutionAmount,
        });

        const [schedulePda] = getSchedulePda(vaultPda, scheduleId);
        await waitForConfirmation(connection, signature);
    } catch (error: any) {
        console.error("Error creating schedule:", error.message);
        throw error;
    }
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
