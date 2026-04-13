import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { buildMerkleTree, getSchedulePda, getVaultPda, Recipient } from "@veil-dev/sdk";
import * as fs from "fs";
import * as path from "path";
import { config } from "./config";
import { createLogger } from "./logger";

const connection = new Connection(config.solanaRpcUrl, "confirmed");
const readOnlyWallet = new Wallet(Keypair.generate());
const provider = new AnchorProvider(connection, readOnlyWallet, {
    commitment: "confirmed",
});
const idlPath = path.resolve(__dirname, "../../sdk/src/idl/idl.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
const program = new Program(idl as Idl, provider);
const logger = createLogger("registration");

export class RegistrationValidationError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number = 400
    ) {
        super(message);
        this.name = "RegistrationValidationError";
    }
}

export interface RegisterScheduleRequest {
    schedulePda: string;
    scheduleId: number[];
    vaultEmployer: string;
    tokenMint: string;
    recipients: Array<{ address: string; amount: string }>;
}

export interface ValidatedScheduleRegistration {
    schedulePda: string;
    scheduleId: number[];
    vaultEmployer: string;
    tokenMint: string;
    recipients: Recipient[];
    merkleRoot: number[];
    proofs: ReturnType<typeof buildMerkleTree>["proofs"];
}

export async function validateScheduleRegistration(
    payload: RegisterScheduleRequest
): Promise<ValidatedScheduleRegistration> {
    const { schedulePda, scheduleId, vaultEmployer, tokenMint, recipients } = payload;

    if (
        !schedulePda ||
        !scheduleId ||
        !vaultEmployer ||
        !tokenMint ||
        !Array.isArray(recipients)
    ) {
        throw new RegistrationValidationError(
            "Missing required fields: schedulePda, scheduleId, vaultEmployer, tokenMint, recipients"
        );
    }

    if (scheduleId.length !== 32 || scheduleId.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
        throw new RegistrationValidationError("scheduleId must be an array of 32 byte values");
    }

    if (recipients.length === 0) {
        throw new RegistrationValidationError("at least one recipient is required");
    }

    const schedulePubkey = parsePublicKey(schedulePda, "schedulePda");
    const employerPubkey = parsePublicKey(vaultEmployer, "vaultEmployer");
    const tokenMintPubkey = parsePublicKey(tokenMint, "tokenMint");

    const recipientList = recipients.map((recipient, index) => ({
        address: parsePublicKey(recipient.address, `recipients[${index}].address`),
        amount: parseAmount(recipient.amount, `recipients[${index}].amount`),
    }));

    const [derivedVaultPda] = getVaultPda(employerPubkey, tokenMintPubkey);
    const [derivedSchedulePda] = getSchedulePda(derivedVaultPda, scheduleId);
    if (!schedulePubkey.equals(derivedSchedulePda)) {
        logger.warn({ schedulePda, vaultEmployer }, "Schedule PDA does not match derived PDA");
        throw new RegistrationValidationError("schedulePda does not match vaultEmployer + tokenMint + scheduleId");
    }

    const accounts = program.account as any;
    const scheduleAccount: any = await fetchRequiredAccount(
        () => accounts.scheduleAccount.fetch(schedulePubkey),
        "schedule account not found"
    );
    const vaultAccount: any = await fetchRequiredAccount(
        () => accounts.vaultAccount.fetch(derivedVaultPda),
        "vault account not found"
    );

    if (scheduleAccount.employer.toString() !== employerPubkey.toString()) {
        logger.warn({ schedulePda, vaultEmployer }, "Vault employer mismatch against on-chain schedule");
        throw new RegistrationValidationError("vaultEmployer does not match the on-chain schedule");
    }
    if (scheduleAccount.vault.toString() !== derivedVaultPda.toString()) {
        logger.warn({ schedulePda }, "Derived vault PDA mismatch against on-chain schedule");
        throw new RegistrationValidationError("on-chain schedule vault does not match derived vault PDA");
    }
    if (vaultAccount.employer.toString() !== employerPubkey.toString()) {
        logger.warn({ schedulePda, vaultEmployer }, "Vault employer mismatch against on-chain vault");
        throw new RegistrationValidationError("vaultEmployer does not match the on-chain vault");
    }
    if (vaultAccount.tokenMint.toString() !== tokenMintPubkey.toString()) {
        logger.warn({ schedulePda, tokenMint }, "Token mint mismatch against on-chain vault");
        throw new RegistrationValidationError("tokenMint does not match the on-chain vault");
    }
    if (scheduleAccount.totalRecipients !== recipientList.length) {
        logger.warn(
            { schedulePda, expected: scheduleAccount.totalRecipients, actual: recipientList.length },
            "Recipient count mismatch against on-chain schedule"
        );
        throw new RegistrationValidationError("recipient count does not match the on-chain schedule");
    }

    let totalRecipientAmount = 0n;
    for (const recipient of recipientList) {
        totalRecipientAmount += recipient.amount;
    }

    if (totalRecipientAmount !== BigInt(scheduleAccount.perExecutionAmount.toString())) {
        logger.warn({ schedulePda }, "Recipient sum mismatch against on-chain perExecutionAmount");
        throw new RegistrationValidationError(
            "sum of recipient amounts must equal the on-chain perExecutionAmount"
        );
    }

    const { root, proofs } = buildMerkleTree(recipientList);
    if (!Buffer.from(root).equals(Buffer.from(scheduleAccount.merkleRoot))) {
        logger.warn({ schedulePda }, "Computed Merkle root mismatch against on-chain schedule");
        throw new RegistrationValidationError("computed Merkle root does not match the on-chain schedule");
    }

    return {
        schedulePda,
        scheduleId,
        vaultEmployer,
        tokenMint,
        recipients: recipientList,
        merkleRoot: Array.from(root),
        proofs,
    };
}

function parsePublicKey(value: string, field: string): PublicKey {
    try {
        return new PublicKey(value);
    } catch {
        throw new RegistrationValidationError(`${field} is not a valid public key`);
    }
}

function parseAmount(value: string, field: string): bigint {
    try {
        const amount = BigInt(value);
        if (amount <= 0n) {
            throw new RegistrationValidationError(`${field} must be greater than 0`);
        }
        return amount;
    } catch (error) {
        if (error instanceof RegistrationValidationError) {
            throw error;
        }
        throw new RegistrationValidationError(`${field} must be a valid integer string`);
    }
}

async function fetchRequiredAccount<T>(
    fetcher: () => Promise<T>,
    message: string
): Promise<T> {
    try {
        return await fetcher();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
            errorMessage.includes("does not exist") ||
            errorMessage.includes("has no data") ||
            errorMessage.includes("Account not found")
        ) {
            throw new RegistrationValidationError(message, 404);
        }
        throw error;
    }
}
