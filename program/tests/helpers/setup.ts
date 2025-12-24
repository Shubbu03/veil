import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Veil } from "../../target/types/veil";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
    createMint,
    createAssociatedTokenAccount,
    mintTo,
    getAssociatedTokenAddress,
} from "@solana/spl-token";
import { getConfigPda } from "./pdas";
import { airdrop } from "./utils";

export interface TestContext {
    provider: anchor.AnchorProvider;
    program: Program<Veil>;
    admin: anchor.Wallet;
    governance: Keypair;
    erAuthority: Keypair;
    employer: Keypair;
    allowedMint: PublicKey;
    configPda: PublicKey;
}

export async function createTestContext(): Promise<TestContext> {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.veil as Program<Veil>;

    const governance = Keypair.generate();
    const erAuthority = Keypair.generate();
    const employer = Keypair.generate();

    const [configPda] = getConfigPda();

    await Promise.all([
        airdrop(provider.connection, governance.publicKey),
        airdrop(provider.connection, erAuthority.publicKey),
        airdrop(provider.connection, employer.publicKey),
    ]);

    const allowedMint = await createMint(
        provider.connection,
        provider.wallet.payer,
        provider.wallet.publicKey,
        null,
        6
    );

    return {
        provider,
        program,
        admin: provider.wallet as anchor.Wallet,
        governance,
        erAuthority,
        employer,
        allowedMint,
        configPda,
    };
}

export async function setupEmployerWithTokens(
    ctx: TestContext,
    employer: PublicKey,
    amount: number
): Promise<PublicKey> {
    const ata = await createAssociatedTokenAccount(
        ctx.provider.connection,
        ctx.admin.payer,
        ctx.allowedMint,
        employer
    );

    await mintTo(
        ctx.provider.connection,
        ctx.admin.payer,
        ctx.allowedMint,
        ata,
        ctx.admin.publicKey,
        amount
    );

    return ata;
}

export async function getEmployerAta(ctx: TestContext): Promise<PublicKey> {
    const ata = await getAssociatedTokenAddress(
        ctx.allowedMint,
        ctx.employer.publicKey
    );

    try {
        await ctx.provider.connection.getAccountInfo(ata);
        return ata;
    } catch {
        return await createAssociatedTokenAccount(
            ctx.provider.connection,
            ctx.admin.payer,
            ctx.allowedMint,
            ctx.employer.publicKey
        );
    }
}

export async function ensureConfigInitialized(ctx: TestContext): Promise<void> {
    try {
        const config = await ctx.program.account.veilConfig.fetch(ctx.configPda);
        ctx.allowedMint = config.allowedMint;
    } catch {
        await ctx.program.methods
            .initConfig(
                ctx.governance.publicKey,
                ctx.erAuthority.publicKey,
                ctx.allowedMint,
                1024
            )
            .accountsPartial({ admin: ctx.admin.publicKey })
            .rpc();
    }
}

export async function ensureUnpaused(ctx: TestContext): Promise<void> {
    const config = await ctx.program.account.veilConfig.fetch(ctx.configPda);
    if (config.paused) {
        await ctx.program.methods
            .unpause()
            .accountsPartial({ governance: ctx.governance.publicKey })
            .signers([ctx.governance])
            .rpc();
    }
}

export async function ensurePaused(ctx: TestContext): Promise<void> {
    const config = await ctx.program.account.veilConfig.fetch(ctx.configPda);
    if (!config.paused) {
        await ctx.program.methods
            .pause()
            .accountsPartial({ governance: ctx.governance.publicKey })
            .signers([ctx.governance])
            .rpc();
    }
}

