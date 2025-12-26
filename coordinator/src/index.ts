import express from "express";
import { Connection, Keypair } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import { config } from "./config";
import { startScheduler, stopScheduler } from "./scheduler";
import apiRouter from "./api";

async function main() {
    console.log("🚀 Starting Veil Coordinator...");

    const solanaConnection = new Connection(config.solanaRpcUrl, "confirmed");
    console.log(`   Solana RPC: ${config.solanaRpcUrl}`);

    const erAuthorityKeypair = config.getErAuthorityKeypair();
    const erAuthority = new Wallet(erAuthorityKeypair);
    console.log(`   ER Authority: ${erAuthority.publicKey.toString()}`);

    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);

    app.get("/", (_req, res) => {
        res.json({ service: "veil-coordinator", status: "running" });
    });

    const server = app.listen(config.port, () => {
        console.log(`   API server running on port ${config.port}`);
    });

    startScheduler(solanaConnection, erAuthority);

    process.on("SIGINT", () => {
        console.log("\n🛑 Shutting down...");
        stopScheduler();
        server.close(() => {
            console.log("✅ Coordinator stopped");
            process.exit(0);
        });
    });
}

main().catch((err) => {
    console.error("❌ Fatal error:", err);
    process.exit(1);
});

