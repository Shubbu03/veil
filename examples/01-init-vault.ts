import { VeilClient, getVaultPda } from "@veil/sdk";
import { getConnection, getDefaultWallet, USDC_DEVNET, printSeparator, formatPubkey } from "./helpers";

async function main() {
    printSeparator("Example 1: Initialize Vault");

    const connection = getConnection();
    const wallet = getDefaultWallet();
    const client = new VeilClient({ connection, wallet });

    const existingVault = await client.getVault();

    if (existingVault) {
        return;
    }

    try {
        await client.initVault(USDC_DEVNET);
    } catch (error: any) {
        console.error("Error initializing vault:", error.message);
        throw error;
    }
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
