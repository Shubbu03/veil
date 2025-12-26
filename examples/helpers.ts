import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

// Devnet USDC mint
export const USDC_DEVNET = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

// Solana devnet RPC
export const DEVNET_RPC = "https://api.devnet.solana.com";

// Coordinator API URL
export const COORDINATOR_API = process.env.COORDINATOR_API || "http://localhost:3001";

export function loadKeypair(filePath: string): Keypair {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
        throw new Error(`Keypair file not found: ${resolved}`);
    }
    const secretKey = JSON.parse(fs.readFileSync(resolved, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

export function getDefaultWallet(): Wallet {
    const keypairPath = path.join(
        process.env.HOME || "~",
        ".config/solana/id.json"
    );
    const keypair = loadKeypair(keypairPath);
    return new Wallet(keypair);
}

export function getConnection(): Connection {
    return new Connection(DEVNET_RPC, "confirmed");
}

export async function checkBalance(publicKey: PublicKey): Promise<number> {
    const connection = getConnection();
    const balance = await connection.getBalance(publicKey);
    return balance / 1e9;
}

export async function waitForConfirmation(
    connection: Connection,
    signature: string,
    maxAttempts = 30
): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
        const status = await connection.getSignatureStatus(signature);
        if (status?.value?.confirmationStatus === "confirmed" ||
            status?.value?.confirmationStatus === "finalized") {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Transaction ${signature} not confirmed after ${maxAttempts} seconds`);
}

export function printSeparator(title?: string): void {
    console.log("\n" + "=".repeat(60));
    if (title) {
        console.log(`  ${title}`);
        console.log("=".repeat(60));
    }
}

export function formatPubkey(pubkey: PublicKey): string {
    const str = pubkey.toString();
    return `${str.slice(0, 4)}...${str.slice(-4)}`;
}

