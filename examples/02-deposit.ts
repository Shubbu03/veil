import { BN } from "@coral-xyz/anchor";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { VeilClient, getVaultPda } from "@veil/sdk";
import {
    getConnection,
    getDefaultWallet,
    USDC_DEVNET,
    printSeparator,
    formatPubkey,
    waitForConfirmation,
} from "./helpers";

async function main() {
    printSeparator("Example 2: Deposit Tokens to Vault");

    const amountArg = process.argv[2];
    const amount = amountArg ? parseInt(amountArg) : 1_000_000;

    const connection = getConnection();
    const wallet = getDefaultWallet();
    const client = new VeilClient({ connection, wallet });

    const vault = await client.getVault();
    if (!vault) {
        console.error("Vault not found! Please run 01-init-vault.ts first.");
        process.exit(1);
    }

    const employerAta = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        USDC_DEVNET,
        wallet.publicKey
    );

    const balance = await connection.getTokenAccountBalance(employerAta.address);

    if (balance.value.amount < amount.toString()) {
        console.error("Insufficient balance");
        process.exit(1);
    }

    try {
        const signature = await client.deposit(new BN(amount), USDC_DEVNET);
        await waitForConfirmation(connection, signature);
    } catch (error: any) {
        console.error("Error depositing tokens:", error.message);
        throw error;
    }
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
