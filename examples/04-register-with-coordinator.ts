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
        console.error("Missing required arguments");
        console.error("Usage: ts-node examples/04-register-with-coordinator.ts <schedulePda> <scheduleId> <vaultEmployer>");
        process.exit(1);
    }

    const connection = getConnection();
    const wallet = getDefaultWallet();
    const client = new VeilClient({ connection, wallet });

    const schedulePda = new PublicKey(schedulePdaArg);
    const scheduleId = JSON.parse(scheduleIdArg);
    const vaultEmployer = new PublicKey(vaultEmployerArg);

    try {
        const schedule = await client.getSchedule(schedulePda);
        if (!schedule) {
            console.error("Schedule not found");
            process.exit(1);
        }
    } catch (error: any) {
        console.error("Error fetching schedule:", error.message);
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

    buildMerkleTree(recipients);

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

        await fetch(`${COORDINATOR_API}/api/schedules/${schedulePda.toString()}`);
    } catch (error: any) {
        console.error("Error registering with coordinator:", error.message);
        if (error.message.includes("ECONNREFUSED")) {
            console.error("Make sure the coordinator is running: cd coordinator && yarn dev");
        }
        throw error;
    }
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
