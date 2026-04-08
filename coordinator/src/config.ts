import { config as dotenvConfig } from "dotenv";
import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

dotenvConfig();

function loadKeypair(keypairPath: string): Keypair {
    const resolved = path.resolve(keypairPath);
    if (!fs.existsSync(resolved)) {
        throw new Error(`Keypair file not found: ${resolved}`);
    }
    const secretKey = JSON.parse(fs.readFileSync(resolved, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

export const config = {
    solanaRpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",

    erRpcUrl: process.env.ER_RPC_URL || "https://devnet.magicblock.app",
    erValidator: process.env.ER_VALIDATOR || "MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd",
    getErAuthorityKeypair: () => {
        const keypairPath = process.env.ER_AUTHORITY_KEYPAIR_PATH || "./er-authority-keypair.json";
        return loadKeypair(keypairPath);
    },

    port: parseInt(process.env.PORT || "3001", 10),
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || "60000", 10),
    maxExecutionAttempts: parseInt(process.env.MAX_EXECUTION_ATTEMPTS || "5", 10),
    retryBaseDelayMs: parseInt(process.env.RETRY_BASE_DELAY_MS || "30000", 10),
    retryMaxDelayMs: parseInt(process.env.RETRY_MAX_DELAY_MS || "7200000", 10),
    maxRunnableExecutionsPerPoll: parseInt(
        process.env.MAX_RUNNABLE_EXECUTIONS_PER_POLL || "10",
        10
    ),
} as const;
