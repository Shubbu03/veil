import type { Request } from "express";
import { ed25519 } from "@noble/curves/ed25519";
import { PublicKey } from "@solana/web3.js";

const PAYLOAD_ACCESS_WINDOW_MS = 5 * 60 * 1000;

export class PayloadAccessError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string
    ) {
        super(message);
        this.name = "PayloadAccessError";
    }
}

export function assertSchedulePayloadAccess(
    req: Request,
    schedulePda: string,
    ownerWallet: string
) {
    const walletAddress = readHeader(req, "x-veil-wallet");
    const timestampHeader = readHeader(req, "x-veil-timestamp");
    const signatureHeader = readHeader(req, "x-veil-signature");

    if (!walletAddress || !timestampHeader || !signatureHeader) {
        throw new PayloadAccessError(401, "Wallet signature is required to fetch schedule payloads.");
    }

    if (walletAddress !== ownerWallet) {
        throw new PayloadAccessError(403, "Only the schedule owner can fetch the stored recipient payload.");
    }

    const timestampMs = Number.parseInt(timestampHeader, 10);
    if (!Number.isFinite(timestampMs)) {
        throw new PayloadAccessError(401, "Invalid payload access timestamp.");
    }

    if (Math.abs(Date.now() - timestampMs) > PAYLOAD_ACCESS_WINDOW_MS) {
        throw new PayloadAccessError(401, "Payload access signature expired. Sign again and retry.");
    }

    let publicKey: PublicKey;
    try {
        publicKey = new PublicKey(walletAddress);
    } catch {
        throw new PayloadAccessError(401, "Invalid wallet address in payload access headers.");
    }

    let signature: Uint8Array;
    try {
        signature = Buffer.from(signatureHeader, "base64");
    } catch {
        throw new PayloadAccessError(401, "Invalid payload access signature encoding.");
    }

    if (signature.length !== 64) {
        throw new PayloadAccessError(401, "Invalid payload access signature length.");
    }

    const message = buildSchedulePayloadAccessMessage(schedulePda, walletAddress, timestampMs);
    const verified = ed25519.verify(signature, message, publicKey.toBytes());
    if (!verified) {
        throw new PayloadAccessError(401, "Could not verify payload access signature.");
    }
}

export function buildSchedulePayloadAccessMessage(
    schedulePda: string,
    walletAddress: string,
    timestampMs: number
) {
    return new TextEncoder().encode(
        [
            "Veil schedule payload access",
            `wallet:${walletAddress}`,
            `schedule:${schedulePda}`,
            `timestamp:${timestampMs}`,
        ].join("\n")
    );
}

function readHeader(req: Request, name: string) {
    const value = req.headers[name];
    return typeof value === "string" ? value.trim() : "";
}
