import { BN } from "@coral-xyz/anchor";
import { VeilClient, getVaultPda, getSchedulePda } from "@veil/sdk";
import {
    getConnection,
    getDefaultWallet,
    USDC_DEVNET,
    printSeparator,
    formatPubkey,
    waitForConfirmation,
} from "./helpers";

async function main() {
    printSeparator("Example 3: Create Payment Schedule");

    const connection = getConnection();
    const wallet = getDefaultWallet();
    const client = new VeilClient({ connection, wallet });

    console.log(`\nSetup:`);
    console.log(`   Wallet: ${formatPubkey(wallet.publicKey)}`);
    console.log(`   Token Mint: ${formatPubkey(USDC_DEVNET)}`);

    console.log(`\nChecking vault...`);
    const vault = await client.getVault();
    if (!vault) {
        console.error(`\nVault not found! Please run 01-init-vault.ts first.`);
        process.exit(1);
    }
    const [vaultPda] = getVaultPda(wallet.publicKey);
    console.log(`   Vault found: ${formatPubkey(vaultPda)}`);
    console.log(`   Available: ${vault.available.toString()} (${vault.available.toNumber() / 1_000_000} USDC)`);

    const recipients = [
        {
            address: wallet.publicKey,
            amount: 100_000n,
        },
        {
            address: wallet.publicKey,
            amount: 200_000n,
        },
        {
            address: wallet.publicKey,
            amount: 300_000n,
        },
    ];

    console.log(`\nCreating schedule with ${recipients.length} recipients:`);
    recipients.forEach((r, i) => {
        console.log(`   ${i + 1}. ${formatPubkey(r.address)}: ${r.amount / 1_000_000n} USDC`);
    });

    const totalAmount = recipients.reduce((sum, r) => sum + r.amount, 0n);
    const perExecutionAmount = new BN(totalAmount.toString());
    const reservedAmount = perExecutionAmount.mul(new BN(10));

    console.log(`\nSchedule Details:`);
    console.log(`   Total per execution: ${perExecutionAmount.toString()} (${perExecutionAmount.toNumber() / 1_000_000} USDC)`);
    console.log(`   Reserved amount: ${reservedAmount.toString()} (${reservedAmount.toNumber() / 1_000_000} USDC)`);
    console.log(`   Interval: 3600 seconds (1 hour)`);

    if (vault.available.lt(reservedAmount)) {
        console.error(`\nInsufficient vault balance!`);
        console.error(`   Required: ${reservedAmount.toString()} (${reservedAmount.toNumber() / 1_000_000} USDC)`);
        console.error(`   Available: ${vault.available.toString()} (${vault.available.toNumber() / 1_000_000} USDC)`);
        process.exit(1);
    }

    console.log(`\nCreating schedule on-chain...`);
    try {
        const { signature, scheduleId, merkleRoot } = await client.createScheduleFromRecipients({
            recipients,
            intervalSecs: 3600,
            reservedAmount,
            perExecutionAmount,
        });

        console.log(`\nSchedule created successfully!`);
        console.log(`   Transaction: ${signature}`);
        console.log(`   Schedule ID: ${Buffer.from(scheduleId).toString("hex")}`);
        console.log(`   Merkle Root: ${Buffer.from(merkleRoot).toString("hex")}`);
        console.log(`   View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

        const [schedulePda] = getSchedulePda(vaultPda, scheduleId);

        console.log(`\nSchedule Details:`);
        console.log(`   Schedule PDA: ${schedulePda.toString()}`);
        console.log(`   Vault PDA: ${formatPubkey(vaultPda)}`);

        await waitForConfirmation(connection, signature);

        const schedule = await client.getSchedule(schedulePda);
        if (schedule) {
            console.log(`\nSchedule State:`);
            console.log(`   Status: ${schedule.status}`);
            console.log(`   Next Execution: ${new Date(schedule.nextExecution.toNumber() * 1000).toISOString()}`);
            console.log(`   Reserved Amount: ${schedule.reservedAmount.toString()}`);
            console.log(`   Per Execution: ${schedule.perExecutionAmount.toString()}`);
            console.log(`   Total Recipients: ${schedule.totalRecipients}`);
        }

        console.log(`\nSave this information for registering with coordinator:`);
        console.log(`   Schedule PDA: ${schedulePda.toString()}`);
        console.log(`   Schedule ID: [${scheduleId.join(", ")}]`);
        console.log(`   Vault Employer: ${wallet.publicKey.toString()}`);
    } catch (error: any) {
        console.error(`\nError creating schedule:`, error.message);
        throw error;
    }
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
