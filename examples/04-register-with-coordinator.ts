import { PublicKey } from "@solana/web3.js";
import { VeilClient, buildMerkleTree } from "@veil/sdk";
import {
    getConnection,
    getDefaultWallet,
    USDC_DEVNET,
    printSeparator,
    formatPubkey,
    COORDINATOR_API,
} from "./helpers";

async function main() {
    printSeparator("Example 4: Register Schedule with Coordinator");

    const schedulePdaArg = process.argv[2];
    const scheduleIdArg = process.argv[3];
    const vaultEmployerArg = process.argv[4];

    if (!schedulePdaArg || !scheduleIdArg || !vaultEmployerArg) {
        console.error(`\nMissing required arguments!`);
        console.error(`\nUsage:`);
        console.error(`  ts-node examples/04-register-with-coordinator.ts <schedulePda> <scheduleId> <vaultEmployer>`);
        console.error(`\nExample:`);
        console.error(`  ts-node examples/04-register-with-coordinator.ts \\`);
        console.error(`    "SchedulePDA..." \\`);
        console.error(`    "[1,2,3,...]" \\`);
        console.error(`    "EmployerPubkey..."`);
        process.exit(1);
    }

    const connection = getConnection();
    const wallet = getDefaultWallet();
    const client = new VeilClient({ connection, wallet });

    const schedulePda = new PublicKey(schedulePdaArg);
    const scheduleId = JSON.parse(scheduleIdArg);
    const vaultEmployer = new PublicKey(vaultEmployerArg);

    console.log(`\nSetup:`);
    console.log(`   Schedule PDA: ${schedulePda.toString()}`);
    console.log(`   Schedule ID: ${Buffer.from(scheduleId).toString("hex")}`);
    console.log(`   Vault Employer: ${formatPubkey(vaultEmployer)}`);
    console.log(`   Coordinator API: ${COORDINATOR_API}`);

    console.log(`\nVerifying schedule exists...`);
    try {
        const schedule = await client.getSchedule(schedulePda);
        if (!schedule) {
            console.error(`\nSchedule not found!`);
            process.exit(1);
        }
        console.log(`   Schedule found`);
        console.log(`   Status: ${schedule.status}`);
        console.log(`   Total Recipients: ${schedule.totalRecipients}`);
    } catch (error: any) {
        console.error(`\nError fetching schedule:`, error.message);
        process.exit(1);
    }

    const recipients = [
        {
            address: new PublicKey("11111111111111111111111111111111"),
            amount: 100_000n,
        },
        {
            address: new PublicKey("22222222222222222222222222222222"),
            amount: 200_000n,
        },
        {
            address: new PublicKey("33333333333333333333333333333333"),
            amount: 300_000n,
        },
    ];

    console.log(`\nPreparing recipient data...`);
    console.log(`   Recipients: ${recipients.length}`);

    const { proofs } = buildMerkleTree(recipients);

    const requestBody = {
        schedulePda: schedulePda.toString(),
        scheduleId: scheduleId,
        vaultEmployer: vaultEmployer.toString(),
        tokenMint: USDC_DEVNET.toString(),
        recipients: recipients.map((r) => ({
            address: r.address.toString(),
            amount: r.amount.toString(),
        })),
    };

    console.log(`\nRegistering with coordinator...`);
    try {
        const response = await fetch(`${COORDINATOR_API}/api/schedules`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const error = await response.json() as { error?: string };
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        const result = await response.json() as { merkleRoot: number[] };
        console.log(`\nSchedule registered successfully!`);
        console.log(`   Merkle Root: ${Buffer.from(result.merkleRoot).toString("hex")}`);

        console.log(`\nVerifying registration...`);
        const verifyResponse = await fetch(`${COORDINATOR_API}/api/schedules/${schedulePda.toString()}`);
        if (verifyResponse.ok) {
            const scheduleInfo = await verifyResponse.json() as { schedulePda: string; recipientCount: number; createdAt: number };
            console.log(`   Verified:`);
            console.log(`   Schedule PDA: ${scheduleInfo.schedulePda}`);
            console.log(`   Recipient Count: ${scheduleInfo.recipientCount}`);
            console.log(`   Created At: ${new Date(scheduleInfo.createdAt).toISOString()}`);
        }

        console.log(`\nCoordinator will now monitor this schedule for execution!`);
    } catch (error: any) {
        console.error(`\nError registering with coordinator:`, error.message);
        if (error.message.includes("ECONNREFUSED")) {
            console.error(`\nMake sure the coordinator is running:`);
            console.error(`   cd coordinator && yarn dev`);
        }
        throw error;
    }
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
