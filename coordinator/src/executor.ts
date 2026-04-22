import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet, Idl, BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { config } from "./config";
import { ScheduleRecipientData } from "./types";
import {
    getConfigPda,
    getVaultPda,
    getVaultAtaPda,
} from "@veil-dev/sdk";
import * as fs from "fs";
import * as path from "path";
import type { ExecutionStageRecord } from "./types";
import { createLogger } from "./logger";

export interface ExecuteScheduleResult {
    status: "succeeded" | "failed";
    claimedCount: number;
    alreadyPaidCount: number;
    failedClaimCount: number;
    delegateSignature?: string;
    commitSignature?: string;
    error?: string;
    retryable: boolean;
}
const logger = createLogger("executor");

export async function executeSchedule(
    solanaConnection: Connection,
    erAuthority: Wallet,
    schedulePda: PublicKey,
    scheduleId: number[],
    recipientData: ScheduleRecipientData,
    onStageCompleted?: (record: ExecutionStageRecord) => Promise<void>
): Promise<ExecuteScheduleResult> {
    let delegateSignature: string | undefined;
    let commitSignature: string | undefined;

    const delegateResult = await runStage(
        "delegate",
        onStageCompleted,
        async () => {
            const signature = await delegateSchedule(
                solanaConnection,
                erAuthority,
                schedulePda,
                scheduleId
            );
            return {
                txSignature: signature,
                details: {},
            };
        }
    );

    if (!delegateResult.ok) {
        logger.warn(
            {
                schedulePda: schedulePda.toString(),
                stage: "delegate",
                error: delegateResult.error,
            },
            "Delegate stage failed"
        );
        return {
            status: "failed",
            claimedCount: 0,
            alreadyPaidCount: 0,
            failedClaimCount: 0,
            error: delegateResult.error,
            retryable: true,
        };
    }
    delegateSignature = delegateResult.txSignature;
    logger.info(
        {
            schedulePda: schedulePda.toString(),
            stage: "delegate",
            signature: delegateSignature,
        },
        "Delegate stage succeeded"
    );

    const claimSummary = await executeClaimsOnER(erAuthority, schedulePda, scheduleId, recipientData);
    await onStageCompleted?.({
        stage: "claim",
        status: claimSummary.failedClaims > 0 ? "failed" : "succeeded",
        startedAt: claimSummary.startedAt,
        finishedAt: claimSummary.finishedAt,
        details: {
            claimedCount: claimSummary.successfulClaims,
            alreadyPaidCount: claimSummary.alreadyPaidClaims,
            failedClaimCount: claimSummary.failedClaims,
            failedRecipients: claimSummary.failedRecipients,
        },
        error:
            claimSummary.failedClaims > 0
                ? `failed ${claimSummary.failedClaims} claim(s)`
                : undefined,
    });

    const commitResult = await runStage(
        "commit",
        onStageCompleted,
        async () => {
            const signature = await commitAndUndelegate(solanaConnection, erAuthority, schedulePda);
            return {
                txSignature: signature,
                details: {},
            };
        }
    );

    if (commitResult.ok) {
        commitSignature = commitResult.txSignature;
        logger.info(
            {
                schedulePda: schedulePda.toString(),
                stage: "commit",
                signature: commitSignature,
            },
            "Commit stage succeeded"
        );
    } else {
        logger.warn(
            {
                schedulePda: schedulePda.toString(),
                stage: "commit",
                error: commitResult.error,
            },
            "Commit stage failed"
        );
    }

    const errors: string[] = [];
    if (claimSummary.failedClaims > 0) {
        errors.push(`failed ${claimSummary.failedClaims} claim(s)`);
    }
    if (!commitResult.ok) {
        errors.push(commitResult.error);
    }

    return {
        status: errors.length === 0 ? "succeeded" : "failed",
        claimedCount: claimSummary.successfulClaims,
        alreadyPaidCount: claimSummary.alreadyPaidClaims,
        failedClaimCount: claimSummary.failedClaims,
        delegateSignature,
        commitSignature,
        error: errors.length === 0 ? undefined : errors.join("; "),
        retryable: true,
    };
}

async function delegateSchedule(
    connection: Connection,
    erAuthority: Wallet,
    schedulePda: PublicKey,
    scheduleId: number[]
): Promise<string> {
    const idlPath = path.resolve(__dirname, "../../sdk/src/idl/idl.json");
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

    const provider = new AnchorProvider(connection, erAuthority, {
        commitment: "confirmed",
    });
    const program = new Program(idl as Idl, provider);

    return await program.methods
        .delegateSchedule(scheduleId)
        .accountsPartial({
            payer: erAuthority.publicKey,
            schedule: schedulePda,
        })
        .signers([erAuthority.payer])
        .rpc();
}

async function executeClaimsOnER(
    erAuthority: Wallet,
    schedulePda: PublicKey,
    scheduleId: number[],
    recipientData: ScheduleRecipientData
): Promise<{
    successfulClaims: number;
    alreadyPaidClaims: number;
    failedClaims: number;
    failedRecipients: string[];
    startedAt: number;
    finishedAt: number;
}> {
    const erConnection = new Connection(config.erRpcUrl, "confirmed");
    const startedAt = unixTimestamp();

    const idlPath = path.resolve(__dirname, "../../sdk/src/idl/idl.json");
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

    const erProvider = new AnchorProvider(erConnection, erAuthority, {
        commitment: "confirmed",
    });
    const erProgram = new Program(idl as Idl, erProvider);

    const vaultEmployer = new PublicKey(recipientData.vaultEmployer);
    const tokenMint = new PublicKey(recipientData.tokenMint);
    const [vaultPda] = getVaultPda(vaultEmployer, tokenMint);
    const [vaultAtaPda] = getVaultAtaPda(vaultPda);
    const [configPda] = getConfigPda();
    let successfulClaims = 0;
    let alreadyPaidClaims = 0;
    let failedClaims = 0;
    const failedRecipients: string[] = [];

    for (let i = 0; i < recipientData.recipients.length; i++) {
        const recipient = recipientData.recipients[i];
        const proof = recipientData.proofs[i];
        const recipientPubkey = new PublicKey(recipient.address);
        const amount = new BN(recipient.amount.toString());

        try {
            const recipientAta = await getAssociatedTokenAddress(tokenMint, recipientPubkey);

            const tx = await erProgram.methods
                .claimPayment(
                    scheduleId,
                    recipientPubkey,
                    amount,
                    proof.leafIndex,
                    proof.proof
                )
                .accountsStrict({
                    erAuthority: erAuthority.publicKey,
                    config: configPda,
                    vault: vaultPda,
                    vaultAta: vaultAtaPda,
                    schedule: schedulePda,
                    recipientAta,
                    tokenMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .transaction();

            // Send to ER
            const signature = await erConnection.sendTransaction(tx, [erAuthority.payer]);
            await erConnection.confirmTransaction(signature, "confirmed");
            successfulClaims += 1;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (isAlreadyPaidError(errorMsg)) {
                alreadyPaidClaims += 1;
                continue;
            }

            failedClaims += 1;
            failedRecipients.push(recipientPubkey.toString());
            logger.error(
                {
                    schedulePda: schedulePda.toString(),
                    recipient: recipientPubkey.toString(),
                    stage: "claim",
                    error: errorMsg,
                },
                "Failed to claim for recipient"
            );
        }
    }

    return {
        successfulClaims,
        alreadyPaidClaims,
        failedClaims,
        failedRecipients,
        startedAt,
        finishedAt: unixTimestamp(),
    };
}

async function commitAndUndelegate(
    solanaConnection: Connection,
    erAuthority: Wallet,
    schedulePda: PublicKey
): Promise<string> {
    // Load IDL from SDK
    const idlPath = path.resolve(__dirname, "../../sdk/src/idl/idl.json");
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

    const provider = new AnchorProvider(solanaConnection, erAuthority, {
        commitment: "confirmed",
    });
    const program = new Program(idl as Idl, provider);

    const [configPda] = getConfigPda();

    const signature = await program.methods
        .commit()
        .accountsPartial({
            payer: erAuthority.publicKey,
            config: configPda,
            delegatedAccount: schedulePda,
        })
        .signers([erAuthority.payer])
        .rpc();

    return signature;
}

async function runStage(
    stage: ExecutionStageRecord["stage"],
    onStageCompleted: ((record: ExecutionStageRecord) => Promise<void>) | undefined,
    execute: () => Promise<{ txSignature?: string; details?: Record<string, unknown> }>
): Promise<{ ok: true; txSignature?: string } | { ok: false; error: string }> {
    const startedAt = unixTimestamp();

    try {
        const result = await execute();
        await onStageCompleted?.({
            stage,
            status: "succeeded",
            startedAt,
            finishedAt: unixTimestamp(),
            txSignature: result.txSignature,
            details: result.details,
        });
        return {
            ok: true,
            txSignature: result.txSignature,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await onStageCompleted?.({
            stage,
            status: "failed",
            startedAt,
            finishedAt: unixTimestamp(),
            error: message,
        });
        return {
            ok: false,
            error: message,
        };
    }
}

function isAlreadyPaidError(errorMessage: string): boolean {
    return (
        errorMessage.includes("AlreadyPaid") ||
        errorMessage.includes("Recipient already paid")
    );
}

function unixTimestamp(): number {
    return Math.floor(Date.now() / 1000);
}
