import { PublicKey } from "@solana/web3.js";
import { Recipient, MerkleProof } from "@veil/sdk";

export interface ScheduleRecipientData {
    schedulePda: string;
    scheduleId: number[];
    vaultEmployer: string;
    tokenMint: string; // Token mint address
    recipients: Recipient[];
    proofs: MerkleProof[];
    merkleRoot: number[];
    createdAt: number;
}

export type JobStatus = "pending" | "delegated" | "executing" | "committed" | "failed";

export interface ExecutionJob {
    schedulePda: string;
    scheduleId: number[];
    vaultEmployer: PublicKey;
    status: JobStatus;
    recipients: Recipient[];
    proofs: MerkleProof[];
    nextExecution: number;
    retries: number;
    lastError?: string;
}

