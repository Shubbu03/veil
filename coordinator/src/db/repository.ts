import { eq } from 'drizzle-orm';
import { db, schedules, type Schedule, type NewSchedule } from './index';
import { ScheduleRecipientData } from '../types';
import { PublicKey } from '@solana/web3.js';

export class ScheduleRepository {

    async set(schedulePda: string, data: ScheduleRecipientData): Promise<void> {
        const now = Math.floor(Date.now() / 1000);

        const scheduleData: NewSchedule = {
            schedulePda: data.schedulePda,
            scheduleId: Buffer.from(data.scheduleId).toString('base64'), // Store as base64
            vaultEmployer: data.vaultEmployer,
            tokenMint: data.tokenMint,
            merkleRoot: Buffer.from(data.merkleRoot).toString('base64'), // Store as base64
            recipients: data.recipients.map(r => ({
                address: r.address.toString(),
                amount: r.amount.toString(),
            })),
            proofs: data.proofs.map(p => ({
                leafIndex: p.leafIndex,
                proof: p.proof.map(buf => Array.from(buf)), // Convert Buffer[] to number[][]
            })),
            createdAt: data.createdAt,
            updatedAt: now,
        };

        await db
            .insert(schedules)
            .values(scheduleData)
            .onConflictDoUpdate({
                target: schedules.schedulePda,
                set: {
                    scheduleId: scheduleData.scheduleId,
                    vaultEmployer: scheduleData.vaultEmployer,
                    tokenMint: scheduleData.tokenMint,
                    merkleRoot: scheduleData.merkleRoot,
                    recipients: scheduleData.recipients,
                    proofs: scheduleData.proofs,
                    updatedAt: now,
                },
            });
    }

    async get(schedulePda: string): Promise<ScheduleRecipientData | undefined> {
        const result = await db
            .select()
            .from(schedules)
            .where(eq(schedules.schedulePda, schedulePda))
            .limit(1);

        if (result.length === 0) {
            return undefined;
        }

        const schedule = result[0];
        return this.mapToScheduleRecipientData(schedule);
    }

    async has(schedulePda: string): Promise<boolean> {
        const result = await db
            .select({ schedulePda: schedules.schedulePda })
            .from(schedules)
            .where(eq(schedules.schedulePda, schedulePda))
            .limit(1);

        return result.length > 0;
    }

    async delete(schedulePda: string): Promise<boolean> {
        const result = await db
            .delete(schedules)
            .where(eq(schedules.schedulePda, schedulePda))
            .returning({ schedulePda: schedules.schedulePda });

        return result.length > 0;
    }

    async getAll(): Promise<ScheduleRecipientData[]> {
        const results = await db.select().from(schedules);
        return results.map(schedule => this.mapToScheduleRecipientData(schedule));
    }

    private mapToScheduleRecipientData(schedule: Schedule): ScheduleRecipientData {
        // Convert base64 strings back to number arrays
        const scheduleIdBuffer = Buffer.from(schedule.scheduleId, 'base64');
        const merkleRootBuffer = Buffer.from(schedule.merkleRoot, 'base64');

        return {
            schedulePda: schedule.schedulePda,
            scheduleId: Array.from(scheduleIdBuffer),
            vaultEmployer: schedule.vaultEmployer,
            tokenMint: schedule.tokenMint,
            recipients: schedule.recipients.map(r => ({
                address: new PublicKey(r.address),
                amount: BigInt(r.amount),
            })),
            proofs: schedule.proofs.map(p => ({
                leafIndex: p.leafIndex,
                proof: p.proof.map(arr => Buffer.from(arr)), // Convert number[][] back to Buffer[]
            })),
            merkleRoot: Array.from(merkleRootBuffer),
            createdAt: schedule.createdAt,
        };
    }
}

export const scheduleRepository = new ScheduleRepository();

