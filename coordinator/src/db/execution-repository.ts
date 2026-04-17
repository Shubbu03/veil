import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { db, executionAttempts, executionRuns, type ExecutionAttemptRow, type ExecutionRunRow } from "./index";
import { config } from "../config";
import type { ExecutionAttempt, ExecutionRun, ExecutionRunStatus, ExecutionRunWithAttempts, ExecutionStageRecord } from "../types";
import {
    executionAttemptsTotal,
    executionRunDurationSeconds,
    executionRunsInProgress,
    executionRunsTotal,
} from "../metrics";

const RUNNABLE_STATUSES: ExecutionRunStatus[] = ["pending", "failed"];

export class ExecutionRepository {
    async listRunsForSchedule(schedulePda: string, limit: number): Promise<ExecutionRunWithAttempts[]> {
        const rows = await db
            .select()
            .from(executionRuns)
            .where(eq(executionRuns.schedulePda, schedulePda))
            .orderBy(desc(executionRuns.scheduledFor), desc(executionRuns.id))
            .limit(limit);

        if (rows.length === 0) {
            return [];
        }

        const runIds = rows.map((row) => row.id);
        const attemptRows = await db
            .select()
            .from(executionAttempts)
            .where(inArray(executionAttempts.runId, runIds))
            .orderBy(desc(executionAttempts.attemptNumber), asc(executionAttempts.stage), desc(executionAttempts.startedAt));

        const attemptsByRunId = new Map<number, ExecutionAttempt[]>();
        for (const row of attemptRows) {
            const existing = attemptsByRunId.get(row.runId) ?? [];
            existing.push(mapExecutionAttempt(row));
            attemptsByRunId.set(row.runId, existing);
        }

        return rows.map((row) => ({
            ...mapExecutionRun(row),
            attempts: attemptsByRunId.get(row.id) ?? [],
        }));
    }

    async ensureRunForSchedule(schedulePda: string, scheduledFor: number): Promise<ExecutionRun> {
        const now = unixTimestamp();

        await db
            .insert(executionRuns)
            .values({
                schedulePda,
                scheduledFor,
                status: "pending",
                attemptCount: 0,
                maxAttempts: config.maxExecutionAttempts,
                nextAttemptAt: now,
                createdAt: now,
                updatedAt: now,
            })
            .onConflictDoNothing({
                target: [executionRuns.schedulePda, executionRuns.scheduledFor],
            });

        const existing = await db
            .select()
            .from(executionRuns)
            .where(
                and(
                    eq(executionRuns.schedulePda, schedulePda),
                    eq(executionRuns.scheduledFor, scheduledFor)
                )
            )
            .limit(1);

        if (existing.length === 0) {
            throw new Error(`failed to load execution run for ${schedulePda}`);
        }

        return mapExecutionRun(existing[0]);
    }

    async listRunnableRuns(now: number, limit: number): Promise<ExecutionRun[]> {
        const rows = await db
            .select()
            .from(executionRuns)
            .where(
                and(
                    inArray(executionRuns.status, RUNNABLE_STATUSES),
                    lte(executionRuns.nextAttemptAt, now)
                )
            )
            .orderBy(asc(executionRuns.scheduledFor), asc(executionRuns.nextAttemptAt))
            .limit(limit);

        return rows.map(mapExecutionRun);
    }

    async startRun(runId: number, now: number): Promise<ExecutionRun | null> {
        const rows = await db
            .update(executionRuns)
            .set({
                status: "running",
                attemptCount: sql`${executionRuns.attemptCount} + 1`,
                startedAt: now,
                finishedAt: null,
                updatedAt: now,
                lastError: null,
            })
            .where(
                and(
                    eq(executionRuns.id, runId),
                    inArray(executionRuns.status, RUNNABLE_STATUSES),
                    lte(executionRuns.nextAttemptAt, now)
                )
            )
            .returning();

        if (!rows[0]) {
            return null;
        }

        executionRunsInProgress.inc();
        return mapExecutionRun(rows[0]);
    }

    async recordStage(
        runId: number,
        attemptNumber: number,
        record: ExecutionStageRecord
    ): Promise<void> {
        executionAttemptsTotal.inc({
            stage: record.stage,
            status: record.status,
        });

        await db
            .insert(executionAttempts)
            .values({
                runId,
                attemptNumber,
                stage: record.stage,
                status: record.status,
                txSignature: record.txSignature ?? null,
                details: record.details ?? null,
                error: record.error ?? null,
                startedAt: record.startedAt,
                finishedAt: record.finishedAt,
            })
            .onConflictDoUpdate({
                target: [
                    executionAttempts.runId,
                    executionAttempts.attemptNumber,
                    executionAttempts.stage,
                ],
                set: {
                    status: record.status,
                    txSignature: record.txSignature ?? null,
                    details: record.details ?? null,
                    error: record.error ?? null,
                    startedAt: record.startedAt,
                    finishedAt: record.finishedAt,
                },
            });
    }

    async completeRunSucceeded(
        run: ExecutionRun,
        result: {
            claimedCount: number;
            alreadyPaidCount: number;
            failedClaimCount: number;
            delegateSignature?: string;
            commitSignature?: string;
        }
    ): Promise<void> {
        const now = unixTimestamp();
        const runDuration = run.startedAt ? Math.max(0, now - run.startedAt) : 0;
        executionRunsTotal.inc({ status: "succeeded" });
        executionRunDurationSeconds.observe({ status: "succeeded" }, runDuration);
        executionRunsInProgress.dec();

        await db
            .update(executionRuns)
            .set({
                status: "succeeded",
                finishedAt: now,
                updatedAt: now,
                claimedCount: result.claimedCount,
                alreadyPaidCount: result.alreadyPaidCount,
                failedClaimCount: result.failedClaimCount,
                delegateSignature: result.delegateSignature ?? null,
                commitSignature: result.commitSignature ?? null,
                lastError: null,
            })
            .where(eq(executionRuns.id, run.id));
    }

    async completeRunFailed(
        run: ExecutionRun,
        errorMessage: string,
        result?: {
            claimedCount?: number;
            alreadyPaidCount?: number;
            failedClaimCount?: number;
            delegateSignature?: string;
            commitSignature?: string;
            retryable?: boolean;
        }
    ): Promise<void> {
        const now = unixTimestamp();
        const retryable = result?.retryable ?? true;
        const exhausted = !retryable || run.attemptCount >= run.maxAttempts;
        const nextAttemptAt = exhausted
            ? now
            : now + Math.ceil(getRetryDelayMs(run.attemptCount) / 1000);
        const finalStatus = exhausted ? "exhausted" : "failed";
        const runDuration = run.startedAt ? Math.max(0, now - run.startedAt) : 0;

        executionRunsTotal.inc({ status: finalStatus });
        executionRunDurationSeconds.observe({ status: finalStatus }, runDuration);
        executionRunsInProgress.dec();

        await db
            .update(executionRuns)
            .set({
                status: finalStatus,
                finishedAt: now,
                updatedAt: now,
                nextAttemptAt,
                claimedCount: result?.claimedCount ?? run.claimedCount,
                alreadyPaidCount: result?.alreadyPaidCount ?? run.alreadyPaidCount,
                failedClaimCount: result?.failedClaimCount ?? run.failedClaimCount,
                delegateSignature: result?.delegateSignature ?? run.delegateSignature ?? null,
                commitSignature: result?.commitSignature ?? run.commitSignature ?? null,
                lastError: errorMessage,
            })
            .where(eq(executionRuns.id, run.id));
    }
}

function getRetryDelayMs(attemptNumber: number): number {
    const exponentialDelay = config.retryBaseDelayMs * 2 ** Math.max(0, attemptNumber - 1);
    return Math.min(exponentialDelay, config.retryMaxDelayMs);
}

function mapExecutionRun(row: ExecutionRunRow): ExecutionRun {
    return {
        id: row.id,
        schedulePda: row.schedulePda,
        scheduledFor: row.scheduledFor,
        status: row.status as ExecutionRunStatus,
        attemptCount: row.attemptCount,
        maxAttempts: row.maxAttempts,
        nextAttemptAt: row.nextAttemptAt,
        startedAt: row.startedAt ?? null,
        finishedAt: row.finishedAt ?? null,
        claimedCount: row.claimedCount,
        alreadyPaidCount: row.alreadyPaidCount,
        failedClaimCount: row.failedClaimCount,
        delegateSignature: row.delegateSignature ?? null,
        commitSignature: row.commitSignature ?? null,
        lastError: row.lastError ?? undefined,
    };
}

function mapExecutionAttempt(row: ExecutionAttemptRow): ExecutionAttempt {
    return {
        id: row.id,
        runId: row.runId,
        attemptNumber: row.attemptNumber,
        stage: row.stage as ExecutionAttempt["stage"],
        status: row.status as ExecutionAttempt["status"],
        txSignature: row.txSignature ?? null,
        details: row.details ?? null,
        error: row.error ?? undefined,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
    };
}

function unixTimestamp(): number {
    return Math.floor(Date.now() / 1000);
}

export const executionRepository = new ExecutionRepository();
