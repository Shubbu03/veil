import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { config } from "./config";
import { recipientStore } from "./store";
import { executeSchedule } from "./executor";
import { Idl } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import { executionRepository } from "./db/execution-repository";
import type { ExecutionRun } from "./types";
import { createLogger } from "./logger";
import {
    claimsTotal,
    schedulerDueSchedulesTotal,
    schedulerPollDurationSeconds,
    schedulerPollsTotal,
} from "./metrics";

let schedulerInterval: NodeJS.Timeout | null = null;
let isPolling = false;
const logger = createLogger("scheduler");

export function startScheduler(connection: Connection, erAuthority: Wallet) {
    logger.info({ pollIntervalMs: config.pollIntervalMs }, "Starting scheduler");

    const poll = async () => {
        if (isPolling) {
            return;
        }

        isPolling = true;
        schedulerPollsTotal.inc();
        const stopTimer = schedulerPollDurationSeconds.startTimer();
        try {
            await pollDueSchedules(connection, erAuthority);
        } catch (error) {
            logger.error({ err: error }, "Scheduler error");
        } finally {
            stopTimer();
            isPolling = false;
        }
    };

    poll();

    schedulerInterval = setInterval(poll, config.pollIntervalMs);
}

export function stopScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
    }
}

async function pollDueSchedules(connection: Connection, erAuthority: Wallet) {
    const now = unixTimestamp();
    const dueSchedules = await syncDueSchedules(connection, now);
    const runnableRuns = await executionRepository.listRunnableRuns(
        now,
        config.maxRunnableExecutionsPerPoll
    );

    if (dueSchedules > 0) {
        schedulerDueSchedulesTotal.inc(dueSchedules);
        logger.info({ dueSchedules }, "Synchronized due schedules into execution runs");
    }

    if (runnableRuns.length === 0) {
        return;
    }

    logger.info({ runnableRuns: runnableRuns.length }, "Found execution runs ready to process");

    for (const run of runnableRuns) {
        await processExecutionRun(connection, erAuthority, run);
    }
}

async function syncDueSchedules(connection: Connection, now: number): Promise<number> {
    const idlPath = path.resolve(__dirname, "../../sdk/src/idl/idl.json");
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
    const provider = new AnchorProvider(connection, new Wallet(Keypair.generate()), {
        commitment: "confirmed",
    });
    const program = new Program(idl as Idl, provider);

    const schedules = await (program.account as any).scheduleAccount.all();
    let synchronized = 0;
    for (const acc of schedules) {
        const schedule = acc.account;
        const isDue = schedule.nextExecution.toNumber() <= now;
        const isActive = "active" in schedule.status;

        if (isDue && isActive) {
            const schedulePda = acc.publicKey.toString();
            const recipientData = await recipientStore.get(schedulePda);
            if (!recipientData) {
                continue;
            }
            await executionRepository.ensureRunForSchedule(
                schedulePda,
                schedule.nextExecution.toNumber()
            );
            synchronized += 1;
        }
    }

    return synchronized;
}

async function processExecutionRun(
    connection: Connection,
    erAuthority: Wallet,
    run: ExecutionRun
) {
    const claimedRun = await executionRepository.startRun(run.id, unixTimestamp());
    if (!claimedRun) {
        return;
    }

    try {
        const recipientData = await recipientStore.get(claimedRun.schedulePda);
        if (!recipientData) {
            await executionRepository.completeRunFailed(
                claimedRun,
                `recipient data missing for ${claimedRun.schedulePda}`,
                { retryable: false }
            );
            logger.warn({ schedulePda: claimedRun.schedulePda, runId: claimedRun.id }, "Recipient data missing for execution run");
            return;
        }

        const result = await executeSchedule(
            connection,
            erAuthority,
            new PublicKey(claimedRun.schedulePda),
            recipientData.scheduleId,
            recipientData,
            async (record) => {
                await executionRepository.recordStage(
                    claimedRun.id,
                    claimedRun.attemptCount,
                    record
                );
            }
        );

        if (result.status === "succeeded") {
            claimsTotal.inc({ status: "claimed" }, result.claimedCount);
            claimsTotal.inc({ status: "already_paid" }, result.alreadyPaidCount);
            claimsTotal.inc({ status: "failed" }, result.failedClaimCount);
            await executionRepository.completeRunSucceeded(claimedRun, {
                claimedCount: result.claimedCount,
                alreadyPaidCount: result.alreadyPaidCount,
                failedClaimCount: result.failedClaimCount,
                delegateSignature: result.delegateSignature,
                commitSignature: result.commitSignature,
            });
            logger.info(
                {
                    schedulePda: claimedRun.schedulePda,
                    runId: claimedRun.id,
                    attempt: claimedRun.attemptCount,
                    claimedCount: result.claimedCount,
                    alreadyPaidCount: result.alreadyPaidCount,
                    failedClaimCount: result.failedClaimCount,
                },
                "Execution run completed successfully"
            );
            return;
        }

        claimsTotal.inc({ status: "claimed" }, result.claimedCount);
        claimsTotal.inc({ status: "already_paid" }, result.alreadyPaidCount);
        claimsTotal.inc({ status: "failed" }, result.failedClaimCount);
        await executionRepository.completeRunFailed(claimedRun, result.error ?? "execution failed", {
            claimedCount: result.claimedCount,
            alreadyPaidCount: result.alreadyPaidCount,
            failedClaimCount: result.failedClaimCount,
            delegateSignature: result.delegateSignature,
            commitSignature: result.commitSignature,
            retryable: result.retryable,
        });
        logger.warn(
            {
                schedulePda: claimedRun.schedulePda,
                runId: claimedRun.id,
                attempt: claimedRun.attemptCount,
                error: result.error,
                claimedCount: result.claimedCount,
                alreadyPaidCount: result.alreadyPaidCount,
                failedClaimCount: result.failedClaimCount,
            },
            "Execution run failed"
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await executionRepository.completeRunFailed(claimedRun, message, {
            retryable: true,
        });
        logger.error(
            {
                err: error,
                schedulePda: claimedRun.schedulePda,
                runId: claimedRun.id,
                attempt: claimedRun.attemptCount,
            },
            "Failed to execute schedule"
        );
    }
}

function unixTimestamp(): number {
    return Math.floor(Date.now() / 1000);
}
