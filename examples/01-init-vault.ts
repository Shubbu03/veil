import { VeilClient, getVaultPda } from "@veil/sdk";
import { getConnection, getDefaultWallet, USDC_DEVNET, printSeparator, formatPubkey } from "./helpers";

async function main() {
    printSeparator("Example 1: Initialize Vault");

    const connection = getConnection();
    const wallet = getDefaultWallet();
    const client = new VeilClient({ connection, wallet });

    console.log(`\nSetup:`);
    console.log(`   Wallet: ${formatPubkey(wallet.publicKey)}`);
    console.log(`   Token Mint: ${formatPubkey(USDC_DEVNET)} (USDC Devnet)`);
    console.log(`   RPC: ${connection.rpcEndpoint}`);

    console.log(`\nChecking if vault exists...`);
    const existingVault = await client.getVault();

    if (existingVault) {
        const [vaultPda] = getVaultPda(wallet.publicKey);
        console.log(`\nVault already exists!`);
        console.log(`   Vault PDA: ${formatPubkey(vaultPda)}`);
        console.log(`   Available: ${existingVault.available.toString()}`);
        console.log(`   Reserved: ${existingVault.reserved.toString()}`);
        console.log(`   Token Mint: ${formatPubkey(existingVault.tokenMint)}`);
        return;
    }

    console.log(`\nInitializing vault...`);
    try {
        const signature = await client.initVault(USDC_DEVNET);
        console.log(`\nVault initialized successfully!`);
        console.log(`   Transaction: ${signature}`);
        console.log(`   View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

        const vault = await client.getVault();
        if (vault) {
            const [vaultPda] = getVaultPda(wallet.publicKey);
            console.log(`\nVault Details:`);
            console.log(`   Vault PDA: ${formatPubkey(vaultPda)}`);
            console.log(`   Available: ${vault.available.toString()}`);
            console.log(`   Reserved: ${vault.reserved.toString()}`);
        }
    } catch (error: any) {
        console.error(`\nError initializing vault:`, error.message);
        throw error;
    }
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
