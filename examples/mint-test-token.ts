import { Connection } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { getConnection, getDefaultWallet } from "./helpers";

async function main() {
    const connection = getConnection();
    const wallet = getDefaultWallet();

    const mint = await createMint(
        connection,
        wallet.payer,
        wallet.publicKey,
        null,
        6
    );

    const ata = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        mint,
        wallet.publicKey
    );

    await mintTo(
        connection,
        wallet.payer,
        mint,
        ata.address,
        wallet.publicKey,
        1000_000_000
    );
}

main().catch(console.error);

