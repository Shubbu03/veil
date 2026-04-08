import {
    bigint,
    index,
    integer,
    jsonb,
    pgTable,
    serial,
    text,
    uniqueIndex,
    varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const schedules = pgTable(
    "schedules",
    {
        schedulePda: varchar("schedule_pda", { length: 44 }).primaryKey(),
        scheduleId: text("schedule_id").notNull(),
        vaultEmployer: varchar("vault_employer", { length: 44 }).notNull(),
        tokenMint: varchar("token_mint", { length: 44 }).notNull(),
        merkleRoot: text("merkle_root").notNull(),
        recipients: jsonb("recipients")
            .notNull()
            .$type<Array<{ address: string; amount: string }>>(),
        proofs: jsonb("proofs")
            .notNull()
            .$type<Array<{ leafIndex: number; proof: number[][] }>>(),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" })
            .notNull()
            .default(sql`EXTRACT(EPOCH FROM NOW())::BIGINT`),
    },
    (table) => ({
        vaultEmployerIdx: index("idx_vault_employer").on(table.vaultEmployer),
        createdAtIdx: index("idx_created_at").on(table.createdAt),
        tokenMintIdx: index("idx_token_mint").on(table.tokenMint),
    })
);

export const executionRuns = pgTable(
    "execution_runs",
    {
        id: serial("id").primaryKey(),
        schedulePda: varchar("schedule_pda", { length: 44 })
            .notNull()
            .references(() => schedules.schedulePda, { onDelete: "cascade" }),
        scheduledFor: bigint("scheduled_for", { mode: "number" }).notNull(),
        status: varchar("status", { length: 32 }).notNull(),
        attemptCount: integer("attempt_count").notNull().default(0),
        maxAttempts: integer("max_attempts").notNull().default(5),
        nextAttemptAt: bigint("next_attempt_at", { mode: "number" }).notNull(),
        startedAt: bigint("started_at", { mode: "number" }),
        finishedAt: bigint("finished_at", { mode: "number" }),
        claimedCount: integer("claimed_count").notNull().default(0),
        alreadyPaidCount: integer("already_paid_count").notNull().default(0),
        failedClaimCount: integer("failed_claim_count").notNull().default(0),
        delegateSignature: varchar("delegate_signature", { length: 128 }),
        commitSignature: varchar("commit_signature", { length: 128 }),
        lastError: text("last_error"),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" })
            .notNull()
            .default(sql`EXTRACT(EPOCH FROM NOW())::BIGINT`),
    },
    (table) => ({
        scheduleExecutionUidx: uniqueIndex("execution_runs_schedule_execution_uidx").on(
            table.schedulePda,
            table.scheduledFor
        ),
        runnableIdx: index("idx_execution_runs_runnable").on(table.status, table.nextAttemptAt),
        scheduleIdx: index("idx_execution_runs_schedule").on(table.schedulePda),
    })
);

export const executionAttempts = pgTable(
    "execution_attempts",
    {
        id: serial("id").primaryKey(),
        runId: integer("run_id")
            .notNull()
            .references(() => executionRuns.id, { onDelete: "cascade" }),
        attemptNumber: integer("attempt_number").notNull(),
        stage: varchar("stage", { length: 32 }).notNull(),
        status: varchar("status", { length: 32 }).notNull(),
        txSignature: varchar("tx_signature", { length: 128 }),
        details: jsonb("details").$type<Record<string, unknown> | null>(),
        error: text("error"),
        startedAt: bigint("started_at", { mode: "number" }).notNull(),
        finishedAt: bigint("finished_at", { mode: "number" }).notNull(),
    },
    (table) => ({
        runIdx: index("idx_execution_attempts_run").on(table.runId),
        runAttemptStageUidx: uniqueIndex("execution_attempts_run_attempt_stage_uidx").on(
            table.runId,
            table.attemptNumber,
            table.stage
        ),
    })
);

export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;
export type ExecutionRunRow = typeof executionRuns.$inferSelect;
export type NewExecutionRun = typeof executionRuns.$inferInsert;
export type ExecutionAttemptRow = typeof executionAttempts.$inferSelect;
export type NewExecutionAttempt = typeof executionAttempts.$inferInsert;
