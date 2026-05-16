import { PublicKey } from "@solana/web3.js";
import { Recipient, MerkleProof } from "@veil-dev/sdk";

export interface ScheduleRecipientData {
    schedulePda: string;
    scheduleId: number[];
    vaultEmployer: string;
    tokenMint: string;
    recipients: Recipient[];
    proofs: MerkleProof[];
    merkleRoot: number[];
    createdAt: number;
}

export interface RegisterSchedulePayload {
    schedulePda: string;
    scheduleId: number[];
    vaultEmployer: string;
    tokenMint: string;
    recipients: Array<{ address: string; amount: string }>;
}

export type ExecutionRunStatus =
    | "pending"
    | "running"
    | "succeeded"
    | "failed"
    | "exhausted";

export type ExecutionStage = "delegate" | "claim" | "commit";

export type ExecutionStageStatus = "succeeded" | "failed";

export interface ExecutionRun {
    id: number;
    schedulePda: string;
    scheduledFor: number;
    status: ExecutionRunStatus;
    attemptCount: number;
    maxAttempts: number;
    nextAttemptAt: number;
    startedAt: number | null;
    finishedAt: number | null;
    claimedCount: number;
    alreadyPaidCount: number;
    failedClaimCount: number;
    delegateSignature: string | null;
    commitSignature: string | null;
    lastError?: string;
}

export interface ExecutionStageRecord {
    stage: ExecutionStage;
    status: ExecutionStageStatus;
    startedAt: number;
    finishedAt: number;
    txSignature?: string;
    error?: string;
    details?: Record<string, unknown>;
}

export interface ExecutionAttempt {
    id: number;
    runId: number;
    attemptNumber: number;
    stage: ExecutionStage;
    status: ExecutionStageStatus;
    txSignature: string | null;
    details: Record<string, unknown> | null;
    error?: string;
    startedAt: number;
    finishedAt: number;
}

export interface ExecutionRunWithAttempts extends ExecutionRun {
    attempts: ExecutionAttempt[];
}
