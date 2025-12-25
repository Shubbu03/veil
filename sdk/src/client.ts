import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet, BN, Idl } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import {
    PROGRAM_ID,
    getConfigPda,
    getVaultPda,
    getVaultAtaPda,
} from "./pda";
import { buildMerkleTree, Recipient } from "./merkle";
import {
    VaultAccount,
    ScheduleAccount,
    VeilConfig,
    ScheduleStatus,
    CreateScheduleParams,
} from "./types";
import IDL from "./idl/idl.json";

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
        return await this.program.methods
            .initVault()
            .accountsPartial({
                employer: this.wallet.publicKey,
                tokenMint,
            })
            .rpc();
    }

    async deposit(amount: BN, tokenMint: PublicKey): Promise<string> {
        const [vaultPda] = getVaultPda(this.wallet.publicKey);
        const [vaultAtaPda] = getVaultAtaPda(vaultPda);
        const employerAta = await getAssociatedTokenAddress(
            tokenMint,
            this.wallet.publicKey
        );

        return await this.program.methods
            .deposit(amount)
            .accountsPartial({
                employer: this.wallet.publicKey,
                vaultAta: vaultAtaPda,
                employerAta,
                tokenMint,
            })
            .rpc();
    }

    async withdraw(amount: BN, tokenMint: PublicKey): Promise<string> {
        const [vaultPda] = getVaultPda(this.wallet.publicKey);
        const [vaultAtaPda] = getVaultAtaPda(vaultPda);
        const employerAta = await getAssociatedTokenAddress(
            tokenMint,
            this.wallet.publicKey
        );

        return await this.program.methods
            .withdraw(amount)
            .accountsPartial({
                employer: this.wallet.publicKey,
                vaultAta: vaultAtaPda,
                employerAta,
                tokenMint,
            })
            .rpc();
    }

    async getVault(employer?: PublicKey): Promise<VaultAccount | null> {
        const [vaultPda] = getVaultPda(employer || this.wallet.publicKey);
        try {
            const accounts = this.program.account as any;
            return await accounts.vaultAccount.fetch(vaultPda);
        } catch {
            return null;
        }
    }

    async createSchedule(params: CreateScheduleParams): Promise<string> {
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
            })
            .rpc();
    }

    async createScheduleFromRecipients(opts: {
        recipients: Recipient[];
        intervalSecs: number;
        reservedAmount: BN;
        perExecutionAmount: BN;
    }): Promise<{ signature: string; scheduleId: number[]; merkleRoot: number[] }> {
        const scheduleId = generateScheduleId();
        const erJobId = generateScheduleId();
        const { root } = buildMerkleTree(opts.recipients);

        const signature = await this.createSchedule({
            scheduleId,
            intervalSecs: opts.intervalSecs,
            reservedAmount: opts.reservedAmount,
            perExecutionAmount: opts.perExecutionAmount,
            merkleRoot: Array.from(root),
            totalRecipients: opts.recipients.length,
            erJobId,
        });

        return { signature, scheduleId, merkleRoot: Array.from(root) };
    }

    async pauseSchedule(schedulePda: PublicKey, pause: boolean): Promise<string> {
        return await this.program.methods
            .pauseSchedule(pause)
            .accountsPartial({
                employer: this.wallet.publicKey,
                schedule: schedulePda,
            })
            .rpc();
    }

    async cancelSchedule(schedulePda: PublicKey): Promise<string> {
        return await this.program.methods
            .cancelSchedule()
            .accountsPartial({
                employer: this.wallet.publicKey,
                schedule: schedulePda,
            })
            .rpc();
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
}

export function generateScheduleId(): number[] {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)));
}

function parseScheduleStatus(status: any): ScheduleStatus {
    if ("active" in status) return ScheduleStatus.Active;
    if ("paused" in status) return ScheduleStatus.Paused;
    return ScheduleStatus.Cancelled;
}
