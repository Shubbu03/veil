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

let schedulerInterval: NodeJS.Timeout | null = null;
let isPolling = false;

export function startScheduler(connection: Connection, erAuthority: Wallet) {
    console.log(`Starting scheduler (polling every ${config.pollIntervalMs}ms)`);

    const poll = async () => {
        if (isPolling) {
            return;
        }

        isPolling = true;
        try {
            await pollDueSchedules(connection, erAuthority);
        } catch (error) {
            console.error("Scheduler error:", error);
        } finally {
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
        console.log(`Synchronized ${dueSchedules} due schedule(s) into execution runs`);
    }

    if (runnableRuns.length === 0) {
        return;
    }

    console.log(`Found ${runnableRuns.length} execution run(s) ready to process`);

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
            await executionRepository.completeRunSucceeded(claimedRun.id, {
                claimedCount: result.claimedCount,
                alreadyPaidCount: result.alreadyPaidCount,
                failedClaimCount: result.failedClaimCount,
                delegateSignature: result.delegateSignature,
                commitSignature: result.commitSignature,
            });
            return;
        }

        await executionRepository.completeRunFailed(claimedRun, result.error ?? "execution failed", {
            claimedCount: result.claimedCount,
            alreadyPaidCount: result.alreadyPaidCount,
            failedClaimCount: result.failedClaimCount,
            delegateSignature: result.delegateSignature,
            commitSignature: result.commitSignature,
            retryable: result.retryable,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await executionRepository.completeRunFailed(claimedRun, message, {
            retryable: true,
        });
        console.error(`Failed to execute schedule ${claimedRun.schedulePda}:`, error);
    }
}

function unixTimestamp(): number {
    return Math.floor(Date.now() / 1000);
}
