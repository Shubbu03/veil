import express from "express";
import { Connection, Keypair } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import { config } from "./config";
import { startScheduler, stopScheduler } from "./scheduler";
import apiRouter from "./api";
import { db, queryClient } from "./db";
import { sql } from "drizzle-orm";

async function testDatabaseConnection(): Promise<boolean> {
    try {
        // Simple query to test connection
        await db.execute(sql`SELECT 1`);
        console.log(`Database: Connected ✓`);
        return true;
    } catch (error: any) {
        console.error(`Database: Connection failed ✗`);
        console.error(`Error: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log("Starting Veil Coordinator...");

    // Test database connection first
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
        console.error("Cannot start without database connection");
        console.error("Please check your DATABASE_URL and ensure PostgreSQL is running");
        process.exit(1);
    }

    const solanaConnection = new Connection(config.solanaRpcUrl, "confirmed");
    console.log(`Solana RPC: ${config.solanaRpcUrl}`);

    const erAuthorityKeypair = config.getErAuthorityKeypair();
    const erAuthority = new Wallet(erAuthorityKeypair);
    console.log(`ER Authority: ${erAuthority.publicKey.toString()}`);

    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);

    app.get("/", (_req, res) => {
        res.json({ service: "veil-coordinator", status: "running" });
    });

    const server = app.listen(config.port, () => {
        console.log(`API server running on port ${config.port}`);
    });

    startScheduler(solanaConnection, erAuthority);

    process.on("SIGINT", async () => {
        console.log("\nShutting down...");
        stopScheduler();

        // Close database connection gracefully
        try {
            await queryClient.end();
            console.log("Database connection closed");
        } catch (error) {
            console.error("Error closing database connection:", error);
        }

        server.close(() => {
            console.log("Coordinator stopped");
            process.exit(0);
        });
    });

    process.on("SIGTERM", async () => {
        console.log("\nShutting down (SIGTERM)...");
        stopScheduler();

        try {
            await queryClient.end();
            console.log("Database connection closed");
        } catch (error) {
            console.error("Error closing database connection:", error);
        }

        server.close(() => {
            console.log("Coordinator stopped");
            process.exit(0);
        });
    });
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});

