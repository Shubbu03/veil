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
} as const;

