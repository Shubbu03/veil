import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import IDL from "../target/idl/veil.json";
import { Keypair } from "@solana/web3.js";

async function main() {
    console.log("🔍 Verifying Veil program config on devnet...\n");

    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(process.env.HOME + "/.config/solana/id.json", "utf-8")))
    );
    const provider = new AnchorProvider(connection, new Wallet(adminKeypair), {
        commitment: "confirmed",
    });
    const program = new Program(IDL as any, provider);

    const configPda = PublicKey.findProgramAddressSync(
        [Buffer.from("veil_config")],
        program.programId
    )[0];

    try {
        const config = await (program.account as any).veilConfig.fetch(configPda);
        console.log("✅ Config found on-chain!");
        console.log("\n📋 Config details:");
        console.log("  Config PDA:", configPda.toString());
        console.log("  Governance:", config.governance.toString());
        console.log("  ER Authority:", config.erAuthority.toString());
        console.log("  Allowed Mint:", config.allowedMint.toString());
        console.log("  Max Recipients:", config.maxRecipients.toString());
        console.log("  Paused:", config.paused);
        console.log("\n✅ Setup verified successfully!");
    } catch (error) {
        console.error("❌ Config not found:", error);
        process.exit(1);
    }
}

main().catch(console.error);

