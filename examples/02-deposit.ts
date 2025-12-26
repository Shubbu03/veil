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

    console.log(`\nSetup:`);
    console.log(`   Wallet: ${formatPubkey(wallet.publicKey)}`);
    console.log(`   Token Mint: ${formatPubkey(USDC_DEVNET)}`);
    console.log(`   Amount: ${amount} (${amount / 1_000_000} USDC)`);

    console.log(`\nChecking vault...`);
    const vault = await client.getVault();
    if (!vault) {
        console.error(`\nVault not found! Please run 01-init-vault.ts first.`);
        process.exit(1);
    }
    const [vaultPda] = getVaultPda(wallet.publicKey);
    console.log(`   Vault found: ${formatPubkey(vaultPda)}`);

    console.log(`\nChecking employer token account...`);
    const employerAta = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        USDC_DEVNET,
        wallet.publicKey
    );
    console.log(`   Token Account: ${formatPubkey(employerAta.address)}`);

    const balance = await connection.getTokenAccountBalance(employerAta.address);
    console.log(`   Current Balance: ${balance.value.uiAmount} USDC`);

    if (balance.value.amount < amount.toString()) {
        console.log(`\nInsufficient balance.`);
        console.log(`   Please get USDC test tokens from a devnet faucet or mint them if you have authority.`);
        console.log(`   Required: ${amount / 1_000_000} USDC`);
        console.log(`   Current: ${balance.value.uiAmount} USDC`);
        process.exit(1);
    }

    console.log(`\nDepositing ${amount / 1_000_000} USDC to vault...`);
    try {
        const signature = await client.deposit(new BN(amount), USDC_DEVNET);
        console.log(`\nDeposit successful!`);
        console.log(`   Transaction: ${signature}`);
        console.log(`   View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

        await waitForConfirmation(connection, signature);

        const updatedVault = await client.getVault();
        if (updatedVault) {
            console.log(`\nUpdated Vault Balance:`);
            console.log(`   Available: ${updatedVault.available.toString()} (${updatedVault.available.toNumber() / 1_000_000} USDC)`);
            console.log(`   Reserved: ${updatedVault.reserved.toString()} (${updatedVault.reserved.toNumber() / 1_000_000} USDC)`);
        }
    } catch (error: any) {
        console.error(`\nError depositing tokens:`, error.message);
        throw error;
    }
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
