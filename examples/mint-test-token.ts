import { Connection } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { getConnection, getDefaultWallet } from "./helpers";

async function main() {
    const connection = getConnection();
    const wallet = getDefaultWallet();

    console.log("Creating test token mint...");
    const mint = await createMint(
        connection,
        wallet.payer,
        wallet.publicKey,
        null,
        6
    );

    console.log("Mint created:", mint.toString());

    console.log("Creating token account...");
    const ata = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        mint,
        wallet.publicKey
    );

    console.log("Minting 1000 tokens...");
    await mintTo(
        connection,
        wallet.payer,
        mint,
        ata.address,
        wallet.publicKey,
        1000_000_000
    );

    console.log("\nDone!");
    console.log("Mint Address:", mint.toString());
    console.log("Token Account:", ata.address.toString());
    console.log("\nUpdate helpers.ts USDC_DEVNET to use this mint for testing");
    console.log(`Or set it as: export const USDC_DEVNET = new PublicKey("${mint.toString()}");`);
}

main().catch(console.error);

