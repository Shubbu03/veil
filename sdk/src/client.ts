import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet, BN, Idl } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
    getConfigPda,
    getVaultPda,
    getVaultAtaPda,
    getSchedulePda,
} from "./pda";
import { buildMerkleTree, Recipient } from "./merkle";
import {
    VaultAccount,
    ScheduleAccount,
    VeilConfig,
    ScheduleStatus,
    CreateScheduleParams,
    UpdateScheduleParams,
} from "./types";
import IDL from "./idl/idl.json";
import {
    assertRecipientsMatchPerExecutionAmount,
    assertValidCreateScheduleParams,
    assertValidUpdateScheduleParams,
} from "./validation";

export interface VeilClientConfig {
    connection: Connection;
    wallet: Wallet;
}

export class VeilClient {
    public readonly connection: Connection;
    public readonly wallet: Wallet;
    public readonly provider: AnchorProvider;
    public readonly program: Program;

    constructor(config: VeilClientConfig) {
        this.connection = config.connection;
        this.wallet = config.wallet;
        this.provider = new AnchorProvider(this.connection, this.wallet, {
            commitment: "confirmed",
        });
        this.program = new Program(IDL as Idl, this.provider);
    }

    async initVault(tokenMint: PublicKey): Promise<string> {
        const [vaultPda] = getVaultPda(this.wallet.publicKey, tokenMint);
        const [vaultAtaPda] = getVaultAtaPda(vaultPda);

        return await this.program.methods
            .initVault()
            .accountsPartial({
                employer: this.wallet.publicKey,
                tokenMint,
                vault: vaultPda,
                vaultAta: vaultAtaPda,
            })
            .rpc();
    }

    async deposit(amount: BN, tokenMint: PublicKey): Promise<string> {
        const [vaultPda] = getVaultPda(this.wallet.publicKey, tokenMint);
        const [vaultAtaPda] = getVaultAtaPda(vaultPda);
        const employerAta = await getAssociatedTokenAddress(
            tokenMint,
            this.wallet.publicKey
        );

        return await this.program.methods
            .deposit(amount)
            .accountsPartial({
                employer: this.wallet.publicKey,
                vault: vaultPda,
                vaultAta: vaultAtaPda,
                employerAta,
                tokenMint,
            })
            .rpc();
    }

    async withdraw(amount: BN, tokenMint: PublicKey): Promise<string> {
        const [vaultPda] = getVaultPda(this.wallet.publicKey, tokenMint);
        const [vaultAtaPda] = getVaultAtaPda(vaultPda);
        const employerAta = await getAssociatedTokenAddress(
            tokenMint,
            this.wallet.publicKey
        );

        return await this.program.methods
            .withdraw(amount)
            .accountsPartial({
                employer: this.wallet.publicKey,
                vault: vaultPda,
                vaultAta: vaultAtaPda,
                employerAta,
                tokenMint,
            })
            .rpc();
    }

    async getVault(
        tokenMint: PublicKey,
        employer?: PublicKey
    ): Promise<VaultAccount | null> {
        const [vaultPda] = getVaultPda(employer || this.wallet.publicKey, tokenMint);
        try {
            const accounts = this.program.account as any;
            return await accounts.vaultAccount.fetch(vaultPda);
        } catch {
            return null;
        }
    }

    async createSchedule(params: CreateScheduleParams): Promise<string> {
        assertValidCreateScheduleParams(params);
        const [vaultPda] = getVaultPda(this.wallet.publicKey, params.tokenMint);

        return await this.program.methods
            .createSchedule(
                params.scheduleId,
                new BN(params.intervalSecs),
                params.reservedAmount,
                params.perExecutionAmount,
                params.merkleRoot,
                params.totalRecipients,
                params.erJobId
            )
            .accountsPartial({
                employer: this.wallet.publicKey,
                vault: vaultPda,
            })
            .rpc();
    }

    async createScheduleFromRecipients(opts: {
        tokenMint: PublicKey;
        recipients: Recipient[];
        intervalSecs: number;
        reservedAmount: BN;
        perExecutionAmount: BN;
    }): Promise<{ signature: string; scheduleId: number[]; merkleRoot: number[] }> {
        const scheduleId = generateScheduleId();
        const erJobId = generateScheduleId();
        const { root } = buildMerkleTree(opts.recipients);
        const [vaultPda] = getVaultPda(this.wallet.publicKey, opts.tokenMint);
        const [schedulePda] = getSchedulePda(vaultPda, scheduleId);
        assertRecipientsMatchPerExecutionAmount(opts.recipients, opts.perExecutionAmount);

        let signature = "";

        try {
            signature = await this.createSchedule({
                tokenMint: opts.tokenMint,
                scheduleId,
                intervalSecs: opts.intervalSecs,
                reservedAmount: opts.reservedAmount,
                perExecutionAmount: opts.perExecutionAmount,
                merkleRoot: Array.from(root),
                totalRecipients: opts.recipients.length,
                erJobId,
            });
        } catch (error) {
            if (error instanceof Error && error.message.includes("already been processed")) {
                const existingSchedule = await this.waitForSchedule(schedulePda);

                if (existingSchedule) {
                    return { signature, scheduleId, merkleRoot: Array.from(root) };
                }
            }

            throw error;
        }

        return { signature, scheduleId, merkleRoot: Array.from(root) };
    }

    async updateSchedule(
        schedulePda: PublicKey,
        params: UpdateScheduleParams
    ): Promise<string> {
        assertValidUpdateScheduleParams(params);
        const schedule = await this.getSchedule(schedulePda);
        if (!schedule) {
            throw new Error("schedule not found");
        }

        try {
            return await this.program.methods
                .updateSchedule(
                    new BN(params.intervalSecs),
                    params.reservedAmount,
                    params.perExecutionAmount,
                    params.merkleRoot,
                    params.totalRecipients
                )
                .accountsPartial({
                    employer: this.wallet.publicKey,
                    vault: schedule.vault,
                    schedule: schedulePda,
                })
                .rpc();
        } catch (error) {
            if (error instanceof Error && error.message.includes("already been processed")) {
                const existingSchedule = await this.waitForSchedule(schedulePda);

                if (existingSchedule) {
                    return "";
                }
            }

            throw error;
        }
    }

    async updateScheduleFromRecipients(opts: {
        schedulePda: PublicKey;
        recipients: Recipient[];
        intervalSecs: number;
        reservedAmount: BN;
    }): Promise<{ signature: string; merkleRoot: number[] }> {
        const { root } = buildMerkleTree(opts.recipients);
        const perExecutionAmount = sumRecipientAmounts(opts.recipients);
        assertRecipientsMatchPerExecutionAmount(opts.recipients, perExecutionAmount);

        const signature = await this.updateSchedule(opts.schedulePda, {
            intervalSecs: opts.intervalSecs,
            reservedAmount: opts.reservedAmount,
            perExecutionAmount,
            merkleRoot: Array.from(root),
            totalRecipients: opts.recipients.length,
        });

        return {
            signature,
            merkleRoot: Array.from(root),
        };
    }

    private async waitForSchedule(schedulePda: PublicKey) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const schedule = await this.getSchedule(schedulePda);

            if (schedule) {
                return schedule;
            }

            await sleep(500);
        }

        return null;
    }

    private async waitForScheduleStatus(schedulePda: PublicKey, expectedStatus: ScheduleStatus) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const schedule = await this.getSchedule(schedulePda);

            if (schedule?.status === expectedStatus) {
                return schedule;
            }

            await sleep(500);
        }

        return null;
    }

    async pauseSchedule(schedulePda: PublicKey, pause: boolean): Promise<string> {
        try {
            return await this.program.methods
                .pauseSchedule(pause)
                .accountsPartial({
                    employer: this.wallet.publicKey,
                    schedule: schedulePda,
                })
                .rpc();
        } catch (error) {
            if (error instanceof Error && error.message.includes("already been processed")) {
                const expectedStatus = pause ? ScheduleStatus.Paused : ScheduleStatus.Active;
                const existingSchedule = await this.waitForScheduleStatus(schedulePda, expectedStatus);

                if (existingSchedule) {
                    return "";
                }
            }

            throw error;
        }
    }

    async cancelSchedule(schedulePda: PublicKey): Promise<string> {
        const schedule = await this.getSchedule(schedulePda);
        if (!schedule) {
            throw new Error("schedule not found");
        }

        try {
            return await this.program.methods
                .cancelSchedule()
                .accountsPartial({
                    employer: this.wallet.publicKey,
                    vault: schedule.vault,
                    schedule: schedulePda,
                })
                .rpc();
        } catch (error) {
            if (error instanceof Error && error.message.includes("already been processed")) {
                const existingSchedule = await this.waitForScheduleStatus(schedulePda, ScheduleStatus.Cancelled);

                if (existingSchedule) {
                    return "";
                }
            }

            throw error;
        }
    }

    async getSchedule(schedulePda: PublicKey): Promise<ScheduleAccount | null> {
        try {
            const accounts = this.program.account as any;
            const acc = await accounts.scheduleAccount.fetch(schedulePda);
            return {
                ...acc,
                status: parseScheduleStatus(acc.status),
            };
        } catch {
            return null;
        }
    }

    async getConfig(): Promise<VeilConfig | null> {
        const [configPda] = getConfigPda();
        try {
            const accounts = this.program.account as any;
            return await accounts.veilConfig.fetch(configPda);
        } catch {
            return null;
        }
    }

    async initConfig(
        governance: PublicKey,
        erAuthority: PublicKey,
        allowedMints: PublicKey[],
        whitelistEnabled: boolean,
        maxRecipients: number,
        batchTimeoutSecs: number = 604800 // Default: 7 days
    ): Promise<string> {
        const [configPda] = getConfigPda();

        return await this.program.methods
            .initConfig(
                governance,
                erAuthority,
                allowedMints,
                whitelistEnabled,
                maxRecipients,
                batchTimeoutSecs
            )
            .accountsPartial({
                admin: this.wallet.publicKey,
            })
            .rpc();
    }

    async updateMintWhitelist(
        whitelistEnabled: boolean,
        allowedMints: PublicKey[]
    ): Promise<string> {
        return await this.program.methods
            .updateMintWhitelist(whitelistEnabled, allowedMints)
            .accountsPartial({
                governance: this.wallet.publicKey,
            })
            .rpc();
    }

    async claimPayment(
        erAuthority: Wallet,
        vaultEmployer: PublicKey,
        scheduleId: number[],
        recipient: PublicKey,
        amount: BN,
        leafIndex: number,
        proof: number[][],
        tokenMint: PublicKey
    ): Promise<string> {
        const [configPda] = getConfigPda();
        const [vaultPda] = getVaultPda(vaultEmployer, tokenMint);
        const [vaultAtaPda] = getVaultAtaPda(vaultPda);
        const [schedulePda] = getSchedulePda(vaultPda, scheduleId);
        const recipientAta = await getAssociatedTokenAddress(tokenMint, recipient);

        return await this.program.methods
            .claimPayment(
                scheduleId,
                recipient,
                amount,
                leafIndex,
                proof
            )
            .accountsStrict({
                erAuthority: erAuthority.publicKey,
                config: configPda,
                vault: vaultPda,
                vaultAta: vaultAtaPda,
                schedule: schedulePda,
                recipientAta,
                tokenMint,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([erAuthority.payer])
            .rpc();
    }
}

export function generateScheduleId(): number[] {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)));
}

function sumRecipientAmounts(recipients: Recipient[]): BN {
    let total = 0n;

    for (const recipient of recipients) {
        total += recipient.amount;
    }

    return new BN(total.toString());
}

async function sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

function parseScheduleStatus(status: any): ScheduleStatus {
    if ("active" in status) return ScheduleStatus.Active;
    if ("paused" in status) return ScheduleStatus.Paused;
    return ScheduleStatus.Cancelled;
}
