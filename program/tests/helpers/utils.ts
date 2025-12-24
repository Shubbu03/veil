import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";

export function getErrorCode(err: any): string | undefined {
    if (err.error?.errorCode?.code) return err.error.errorCode.code;
    if (err.errorCode?.code) return err.errorCode.code;
    if (err.code) return err.code;

    if (err.message) {
        const match = err.message.match(/Error Code: (\w+)/);
        if (match) return match[1];
    }
    if (err.logs) {
        for (const log of err.logs) {
            const match = log.match(/Error Code: (\w+)/);
            if (match) return match[1];
        }
    }
    return undefined;
}

export async function airdrop(
    connection: Connection,
    pubkey: PublicKey,
    amount: number = 2 * anchor.web3.LAMPORTS_PER_SOL
): Promise<void> {
    const sig = await connection.requestAirdrop(pubkey, amount);
    await connection.confirmTransaction(sig, "confirmed");
}

export function randomId(): number[] {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 256));
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

