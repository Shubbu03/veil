import express from "express";
import { Connection, Keypair } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import { config } from "./config";
import { startScheduler, stopScheduler } from "./scheduler";
import apiRouter from "./api";
import { db, queryClient } from "./db";
import { sql } from "drizzle-orm";
import { createLogger } from "./logger";

const logger = createLogger("index");

async function testDatabaseConnection(): Promise<boolean> {
    try {
        // Simple query to test connection
        await db.execute(sql`SELECT 1`);
        return true;
    } catch (error: any) {
        logger.error({ err: error }, "Database connection failed");
        return false;
    }
}

async function main() {
    logger.info("Starting Veil Coordinator");

    // Test database connection first
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
        logger.error("Cannot start without database connection");
        logger.error("Please check your DATABASE_URL and ensure PostgreSQL is running");
        process.exit(1);
    }

    const solanaConnection = new Connection(config.solanaRpcUrl, "confirmed");
    logger.info({ solanaRpcUrl: config.solanaRpcUrl }, "Configured Solana RPC");

    const erAuthorityKeypair = config.getErAuthorityKeypair();
    const erAuthority = new Wallet(erAuthorityKeypair);
    logger.info({ erAuthority: erAuthority.publicKey.toString() }, "Loaded ER authority");

    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);

    app.get("/", (_req, res) => {
        res.json({ service: "veil-coordinator", status: "running" });
    });

    const server = app.listen(config.port, () => {
        logger.info({ port: config.port }, "API server running");
    });

    startScheduler(solanaConnection, erAuthority);

    process.on("SIGINT", async () => {
        logger.info({ signal: "SIGINT" }, "Shutting down");
        stopScheduler();

        // Close database connection gracefully
        try {
            await queryClient.end();
            logger.info("Database connection closed");
        } catch (error) {
            logger.error({ err: error }, "Error closing database connection");
        }

        server.close(() => {
            logger.info("Coordinator stopped");
            process.exit(0);
        });
    });

    process.on("SIGTERM", async () => {
        logger.info({ signal: "SIGTERM" }, "Shutting down");
        stopScheduler();

        try {
            await queryClient.end();
            logger.info("Database connection closed");
        } catch (error) {
            logger.error({ err: error }, "Error closing database connection");
        }

        server.close(() => {
            logger.info("Coordinator stopped");
            process.exit(0);
        });
    });
}

main().catch((err) => {
    logger.fatal({ err }, "Fatal error");
    process.exit(1);
});
