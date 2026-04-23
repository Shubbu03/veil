import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export enum ScheduleStatus {
    Active = "Active",
    Paused = "Paused",
    Cancelled = "Cancelled",
}

export interface VaultAccount {
    employer: PublicKey;
    vaultAta: PublicKey;
    tokenMint: PublicKey;
    available: BN;
    reserved: BN;
    bump: number;
}

export interface ScheduleAccount {
    employer: PublicKey;
    vault: PublicKey;
    status: ScheduleStatus;
    intervalSecs: BN;
    nextExecution: BN;
    reservedAmount: BN;
    perExecutionAmount: BN;
    erJobId: number[];
    merkleRoot: number[];
    totalRecipients: number;
    paidCount: number;
    paidBitmap: number[];
    lastExecutedBatch: BN;
    batchStartTime: BN;
    bump: number;
}

export interface VeilConfig {
    erAuthority: PublicKey;
    governance: PublicKey;
    paused: boolean;
    whitelistEnabled: boolean;
    maxRecipients: number;
    allowedMints: PublicKey[];
    batchTimeoutSecs: BN;
}

export interface CreateScheduleParams {
    tokenMint: PublicKey;
    scheduleId: number[];
    intervalSecs: number;
    reservedAmount: BN;
    perExecutionAmount: BN;
    merkleRoot: number[];
    totalRecipients: number;
    erJobId: number[];
}

export interface UpdateScheduleParams {
    intervalSecs: number;
    reservedAmount: BN;
    perExecutionAmount: BN;
    merkleRoot: number[];
    totalRecipients: number;
}
