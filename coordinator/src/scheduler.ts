import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import { config } from "./config";
import { recipientStore } from "./store";
import { executeSchedule } from "./executor";
import { Idl } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

let schedulerInterval: NodeJS.Timeout | null = null;

export function startScheduler(connection: Connection, erAuthority: Wallet) {
    console.log(`⏰ Starting scheduler (polling every ${config.pollIntervalMs}ms)`);

    const poll = async () => {
        try {
            await pollDueSchedules(connection, erAuthority);
        } catch (error) {
            console.error("❌ Scheduler error:", error);
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
    const idlPath = path.resolve(__dirname, "../../sdk/src/idl/idl.json");
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

    const provider = new AnchorProvider(connection, erAuthority, {
        commitment: "confirmed",
    });
    const program = new Program(idl as Idl, provider);

    const schedules = await (program.account as any).scheduleAccount.all();

    const now = Math.floor(Date.now() / 1000);

    const schedulesWithData: any[] = [];
    for (const acc of schedules) {
        const schedule = acc.account;
        const isDue = schedule.nextExecution.toNumber() <= now;
        const isActive = "active" in schedule.status;

        if (isDue && isActive) {
            const hasRecipientData = await recipientStore.has(acc.publicKey.toString());
            if (hasRecipientData) {
                schedulesWithData.push(acc);
            }
        }
    }

    const dueSchedules = schedulesWithData;

    if (dueSchedules.length === 0) {
        return;
    }

    console.log(`📋 Found ${dueSchedules.length} schedules due for execution`);

    for (const scheduleAccount of dueSchedules) {
        const schedulePda = scheduleAccount.publicKey;
        const schedule = scheduleAccount.account;

        try {
            const recipientData = await recipientStore.get(schedulePda.toString());
            if (!recipientData) {
                console.warn(`⚠️  No recipient data for schedule ${schedulePda.toString()}`);
                continue;
            }

            await executeSchedule(
                connection,
                erAuthority,
                schedulePda,
                schedule.scheduleId as number[],
                new PublicKey(schedule.vault),
                recipientData
            );
        } catch (error) {
            console.error(`❌ Failed to execute schedule ${schedulePda.toString()}:`, error);
        }
    }
}

