import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Wallet, Program, AnchorProvider } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import IDL from "../target/idl/veil.json";

async function main() {
    // Setup connection
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    // Load admin keypair (default Solana wallet)
    const adminKeypairPath = process.env.ADMIN_KEYPAIR_PATH ||
        path.join(process.env.HOME || "~", ".config/solana/id.json");

    if (!fs.existsSync(adminKeypairPath)) {
        throw new Error(`Admin keypair not found at: ${adminKeypairPath}`);
    }

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(adminKeypairPath, "utf-8")))
    );
    const adminWallet = new Wallet(adminKeypair);

    // Load ER authority keypair
    const erAuthorityPath = path.resolve(__dirname, "../../er-authority-keypair.json");
    if (!fs.existsSync(erAuthorityPath)) {
        throw new Error(`ER authority keypair not found at: ${erAuthorityPath}`);
    }

    const erAuthorityKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(erAuthorityPath, "utf-8")))
    );

    // Devnet USDC mint
    const USDC_DEVNET = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

    // Setup Anchor provider and program
    const provider = new AnchorProvider(connection, adminWallet, {
        commitment: "confirmed",
    });
    const program = new Program(IDL as any, provider);

    // Check if config already exists
    try {
        const configPda = PublicKey.findProgramAddressSync(
            [Buffer.from("veil_config")],
            program.programId
        )[0];

        await (program.account as any).veilConfig.fetch(configPda);
        return;
    } catch (e) {
        // Config doesn't exist, proceed with initialization
    }

    // Initialize config
    const maxRecipients = 1000;
    const batchTimeoutSecs = 604800; // 7 days (default)

    const tx = await program.methods
        .initConfig(
            adminKeypair.publicKey,  // governance
            erAuthorityKeypair.publicKey,  // er_authority
            USDC_DEVNET,  // allowed_mint
            maxRecipients,  // max_recipients
            batchTimeoutSecs  // batch_timeout_secs
        )
        .accountsPartial({
            admin: adminKeypair.publicKey,
        })
        .rpc();

    // Verify config
    const configPda = PublicKey.findProgramAddressSync(
        [Buffer.from("veil_config")],
        program.programId
    )[0];

    await (program.account as any).veilConfig.fetch(configPda);
}

main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
});

