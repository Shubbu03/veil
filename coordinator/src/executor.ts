import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet, Idl, BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { config } from "./config";
import { ScheduleRecipientData } from "./types";
import {
    getConfigPda,
    getVaultPda,
    getVaultAtaPda,
} from "@veil/sdk";
import * as fs from "fs";
import * as path from "path";

export async function executeSchedule(
    solanaConnection: Connection,
    erAuthority: Wallet,
    schedulePda: PublicKey,
    scheduleId: number[],
    vaultPda: PublicKey,
    recipientData: ScheduleRecipientData
): Promise<void> {
    console.log(`Executing schedule ${schedulePda.toString()}`);

    // Step 1: Delegate schedule to ER (on Solana)
    console.log(`Delegating schedule to ER...`);
    await delegateSchedule(solanaConnection, erAuthority, schedulePda, scheduleId, vaultPda);

    // Step 2: Execute claims on ER
    console.log(`Executing ${recipientData.recipients.length} claims on ER...`);
    await executeClaimsOnER(erAuthority, schedulePda, scheduleId, recipientData);

    // Step 3: Commit state from ER back to Solana base layer
    console.log(`Committing state to Solana...`);
    await commitAndUndelegate(solanaConnection, erAuthority, schedulePda);

    console.log(`Schedule ${schedulePda.toString()} executed successfully`);
}

async function delegateSchedule(
    connection: Connection,
    erAuthority: Wallet,
    schedulePda: PublicKey,
    scheduleId: number[],
    vaultPda: PublicKey
): Promise<string> {
    const idlPath = path.resolve(__dirname, "../../sdk/src/idl/idl.json");
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

    const provider = new AnchorProvider(connection, erAuthority, {
        commitment: "confirmed",
    });
    const program = new Program(idl as Idl, provider);

    return await program.methods
        .delegateSchedule(scheduleId)
        .accountsPartial({
            payer: erAuthority.publicKey,
            schedule: schedulePda,
        })
        .signers([erAuthority.payer])
        .rpc();
}

async function executeClaimsOnER(
    erAuthority: Wallet,
    schedulePda: PublicKey,
    scheduleId: number[],
    recipientData: ScheduleRecipientData
): Promise<void> {
    const erConnection = new Connection(config.erRpcUrl, "confirmed");

    const idlPath = path.resolve(__dirname, "../../sdk/src/idl/idl.json");
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

    const erProvider = new AnchorProvider(erConnection, erAuthority, {
        commitment: "confirmed",
    });
    const erProgram = new Program(idl as Idl, erProvider);

    const vaultEmployer = new PublicKey(recipientData.vaultEmployer);
    const [vaultPda] = getVaultPda(vaultEmployer);
    const [vaultAtaPda] = getVaultAtaPda(vaultPda);
    const [configPda] = getConfigPda();
    const tokenMint = new PublicKey(recipientData.tokenMint);

    for (let i = 0; i < recipientData.recipients.length; i++) {
        const recipient = recipientData.recipients[i];
        const proof = recipientData.proofs[i];
        const recipientPubkey = new PublicKey(recipient.address);
        const amount = new BN(recipient.amount.toString());

        try {
            const recipientAta = await getAssociatedTokenAddress(tokenMint, recipientPubkey);

            console.log(`Claiming for ${recipientPubkey.toString()}: ${amount.toString()}`);

            const tx = await erProgram.methods
                .claimPayment(
                    scheduleId,
                    recipientPubkey,
                    amount,
                    proof.leafIndex,
                    proof.proof
                )
                .accountsPartial({
                    erAuthority: erAuthority.publicKey,
                    config: configPda,
                    vault: vaultPda,
                    vaultAta: vaultAtaPda,
                    schedule: schedulePda,
                    recipientAta,
                    tokenMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .transaction();

            // Send to ER
            const signature = await erConnection.sendTransaction(tx, [erAuthority.payer]);
            await erConnection.confirmTransaction(signature, "confirmed");

            console.log(`Claimed for ${recipientPubkey.toString()}: ${signature}`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(` Failed to claim for ${recipientPubkey.toString()}:`, errorMsg);
        }
    }
}

async function commitAndUndelegate(
    solanaConnection: Connection,
    erAuthority: Wallet,
    schedulePda: PublicKey
): Promise<string> {
    // Load IDL from SDK
    const idlPath = path.resolve(__dirname, "../../sdk/src/idl/idl.json");
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

    const provider = new AnchorProvider(solanaConnection, erAuthority, {
        commitment: "confirmed",
    });
    const program = new Program(idl as Idl, provider);

    const [configPda] = getConfigPda();

    const signature = await program.methods
        .commit()
        .accountsPartial({
            payer: erAuthority.publicKey,
            config: configPda,
            delegatedAccount: schedulePda,
        })
        .signers([erAuthority.payer])
        .rpc();

    return signature;
}

