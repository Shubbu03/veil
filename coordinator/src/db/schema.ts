import { pgTable, varchar, jsonb, bigint, text, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const schedules = pgTable('schedules', {
    schedulePda: varchar('schedule_pda', { length: 44 }).primaryKey(),
    scheduleId: text('schedule_id').notNull(), // Store as base64 encoded string
    vaultEmployer: varchar('vault_employer', { length: 44 }).notNull(),
    tokenMint: varchar('token_mint', { length: 44 }).notNull(),
    merkleRoot: text('merkle_root').notNull(), // Store as base64 encoded string
    recipients: jsonb('recipients').notNull().$type<Array<{ address: string; amount: string }>>(),
    proofs: jsonb('proofs').notNull().$type<Array<{ leafIndex: number; proof: number[][] }>>(), // Store as number[][] for JSON compatibility
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull().default(sql`EXTRACT(EPOCH FROM NOW())::BIGINT`),
}, (table) => ({
    vaultEmployerIdx: index('idx_vault_employer').on(table.vaultEmployer),
    createdAtIdx: index('idx_created_at').on(table.createdAt),
    tokenMintIdx: index('idx_token_mint').on(table.tokenMint),
}));

export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;

