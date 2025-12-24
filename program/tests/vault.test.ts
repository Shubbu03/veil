import { expect } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
    createTestContext,
    ensureConfigInitialized,
    ensureUnpaused,
    setupEmployerWithTokens,
    TestContext,
    getVaultPda,
    getVaultAtaPda,
    getErrorCode,
} from "./helpers";
import { createMint, getAccount } from "@solana/spl-token";

describe("Vault Instructions", () => {
    let ctx: TestContext;
    let unauthorizedUser: Keypair;

    before(async () => {
        ctx = await createTestContext();
        await ensureConfigInitialized(ctx);
        await ensureUnpaused(ctx);

        unauthorizedUser = Keypair.generate();
        await ctx.provider.connection.requestAirdrop(
            unauthorizedUser.publicKey,
            2 * 1e9
        );
    });

    describe("init_vault", () => {
        it("Should initialize vault for employer", async () => {
            const [vaultPda] = getVaultPda(ctx.employer.publicKey);

            await ctx.program.methods
                .initVault()
                .accountsPartial({
                    employer: ctx.employer.publicKey,
                    tokenMint: ctx.allowedMint,
                })
                .signers([ctx.employer])
                .rpc();

            const vault = await ctx.program.account.vaultAccount.fetch(vaultPda);
            expect(vault.employer.toString()).to.equal(ctx.employer.publicKey.toString());
            expect(vault.tokenMint.toString()).to.equal(ctx.allowedMint.toString());
            expect(vault.available.toNumber()).to.equal(0);
            expect(vault.reserved.toNumber()).to.equal(0);

            const [expectedVaultAta] = getVaultAtaPda(vaultPda);
            expect(vault.vaultAta.toString()).to.equal(expectedVaultAta.toString());
        });

        it("Should fail if vault already exists", async () => {
            try {
                await ctx.program.methods
                    .initVault()
                    .accountsPartial({
                        employer: ctx.employer.publicKey,
                        tokenMint: ctx.allowedMint,
                    })
                    .signers([ctx.employer])
                    .rpc();
                expect.fail("Should have failed");
            } catch (err) {
                expect(err).to.not.be.null;
            }
        });

        it("Should fail with invalid mint", async () => {
            const otherEmployer = Keypair.generate();
            await ctx.provider.connection.requestAirdrop(
                otherEmployer.publicKey,
                2 * 1e9
            );
            await ctx.provider.connection.confirmTransaction(
                await ctx.provider.connection.requestAirdrop(otherEmployer.publicKey, 0),
                "confirmed"
            );


            const invalidMint = await createMint(
                ctx.provider.connection,
                ctx.admin.payer,
                ctx.admin.publicKey,
                null,
                6
            );

            try {
                await ctx.program.methods
                    .initVault()
                    .accountsPartial({
                        employer: otherEmployer.publicKey,
                        tokenMint: invalidMint,
                    })
                    .signers([otherEmployer])
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                const errorCode = getErrorCode(err);
                expect(errorCode).to.equal("InvalidMint");
            }
        });

        it("Should fail if program is paused", async () => {
            const newEmployer = Keypair.generate();
            await ctx.provider.connection.requestAirdrop(
                newEmployer.publicKey,
                2 * 1e9
            );
            await ctx.provider.connection.confirmTransaction(
                await ctx.provider.connection.requestAirdrop(
                    newEmployer.publicKey,
                    0
                ),
                "confirmed"
            );

            const config = await ctx.program.account.veilConfig.fetch(ctx.configPda);
            if (config.governance.toString() !== ctx.governance.publicKey.toString()) {
                return;
            }

            await ctx.program.methods
                .pause()
                .accountsPartial({ governance: ctx.governance.publicKey })
                .signers([ctx.governance])
                .rpc();

            try {
                await ctx.program.methods
                    .initVault()
                    .accountsPartial({
                        employer: newEmployer.publicKey,
                        tokenMint: ctx.allowedMint,
                    })
                    .signers([newEmployer])
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                const errorCode = getErrorCode(err);
                expect(errorCode).to.equal("Paused");
            } finally {
                await ensureUnpaused(ctx);
            }
        });
    });

    describe("deposit", () => {
        let employerWithVault: Keypair;
        let vaultPda: PublicKey;
        let employerAta: PublicKey;

        before(async () => {
            employerWithVault = Keypair.generate();
            await ctx.provider.connection.requestAirdrop(
                employerWithVault.publicKey,
                2 * 1e9
            );
            await ctx.provider.connection.confirmTransaction(
                await ctx.provider.connection.requestAirdrop(employerWithVault.publicKey, 0),
                "confirmed"
            );

            [vaultPda] = getVaultPda(employerWithVault.publicKey);

            await ctx.program.methods
                .initVault()
                .accountsPartial({
                    employer: employerWithVault.publicKey,
                    tokenMint: ctx.allowedMint,
                })
                .signers([employerWithVault])
                .rpc();

            employerAta = await setupEmployerWithTokens(ctx, employerWithVault.publicKey, 1_000_000);
        });

        it("Should deposit tokens to vault successfully", async () => {
            const depositAmount = 100_000;
            const vaultBefore = await ctx.program.account.vaultAccount.fetch(vaultPda);
            const [vaultAtaPda] = getVaultAtaPda(vaultPda);

            expect(vaultBefore.available.toNumber()).to.equal(0);
            expect(vaultBefore.reserved.toNumber()).to.equal(0);

            await ctx.program.methods
                .deposit(new BN(depositAmount))
                .accountsPartial({
                    employer: employerWithVault.publicKey,
                    vaultAta: vaultAtaPda,
                    employerAta: employerAta,
                    tokenMint: ctx.allowedMint,
                })
                .signers([employerWithVault])
                .rpc();

            const vaultAfter = await ctx.program.account.vaultAccount.fetch(vaultPda);
            expect(vaultAfter.available.toNumber()).to.equal(depositAmount);
            expect(vaultAfter.reserved.toNumber()).to.equal(0);

            const vaultAtaAccount = await getAccount(
                ctx.provider.connection,
                vaultAtaPda
            );
            expect(Number(vaultAtaAccount.amount)).to.equal(
                vaultAfter.available.toNumber() + vaultAfter.reserved.toNumber()
            );
        });

        it("Should fail if insufficient balance", async () => {
            const depositAmount = 10_000_000;
            const [vaultAtaPda] = getVaultAtaPda(vaultPda);

            try {
                await ctx.program.methods
                    .deposit(new BN(depositAmount))
                    .accountsPartial({
                        employer: employerWithVault.publicKey,
                        vaultAta: vaultAtaPda,
                        employerAta: employerAta,
                        tokenMint: ctx.allowedMint,
                    })
                    .signers([employerWithVault])
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                expect(err).to.not.be.null;
            }
        });
    });

    describe("withdraw", () => {
        let employerWithVault: Keypair;
        let vaultPda: PublicKey;
        let employerAta: PublicKey;

        before(async () => {
            employerWithVault = Keypair.generate();
            await ctx.provider.connection.requestAirdrop(
                employerWithVault.publicKey,
                2 * 1e9
            );
            await ctx.provider.connection.confirmTransaction(
                await ctx.provider.connection.requestAirdrop(employerWithVault.publicKey, 0),
                "confirmed"
            );

            [vaultPda] = getVaultPda(employerWithVault.publicKey);

            await ctx.program.methods
                .initVault()
                .accountsPartial({
                    employer: employerWithVault.publicKey,
                    tokenMint: ctx.allowedMint,
                })
                .signers([employerWithVault])
                .rpc();

            employerAta = await setupEmployerWithTokens(ctx, employerWithVault.publicKey, 1_000_000);
            const vault = await ctx.program.account.vaultAccount.fetch(vaultPda);
            const [vaultAtaPda] = getVaultAtaPda(vaultPda);

            await ctx.program.methods
                .deposit(new BN(500_000))
                .accountsPartial({
                    employer: employerWithVault.publicKey,
                    vaultAta: vaultAtaPda,
                    employerAta: employerAta,
                    tokenMint: ctx.allowedMint,
                })
                .signers([employerWithVault])
                .rpc();
        });

        it("Should withdraw tokens from vault successfully", async () => {
            const withdrawAmount = 100_000;
            const vaultBefore = await ctx.program.account.vaultAccount.fetch(vaultPda);
            const [vaultAtaPda] = getVaultAtaPda(vaultPda);
            const employerAtaBefore = await getAccount(
                ctx.provider.connection,
                employerAta
            );

            await ctx.program.methods
                .withdraw(new BN(withdrawAmount))
                .accountsPartial({
                    employer: employerWithVault.publicKey,
                    vaultAta: vaultAtaPda,
                    employerAta: employerAta,
                    tokenMint: ctx.allowedMint,
                })
                .signers([employerWithVault])
                .rpc();

            const vaultAfter = await ctx.program.account.vaultAccount.fetch(vaultPda);
            expect(vaultAfter.available.toNumber()).to.equal(
                vaultBefore.available.toNumber() - withdrawAmount
            );

            const employerAtaAfter = await getAccount(
                ctx.provider.connection,
                employerAta
            );
            expect(Number(employerAtaAfter.amount)).to.equal(
                Number(employerAtaBefore.amount) + withdrawAmount
            );
        });

        it("Should fail if insufficient available funds", async () => {
            const vault = await ctx.program.account.vaultAccount.fetch(vaultPda);
            const withdrawAmount = vault.available.toNumber() + 1;
            const [vaultAtaPda] = getVaultAtaPda(vaultPda);

            try {
                await ctx.program.methods
                    .withdraw(new BN(withdrawAmount))
                    .accountsPartial({
                        employer: employerWithVault.publicKey,
                        vaultAta: vaultAtaPda,
                        employerAta: employerAta,
                        tokenMint: ctx.allowedMint,
                    })
                    .signers([employerWithVault])
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                const errorCode = getErrorCode(err);
                expect(errorCode).to.equal("InsufficientFunds");
            }
        });

        it("Should fail if unauthorized", async () => {
            const [unauthorizedVaultPda] = getVaultPda(unauthorizedUser.publicKey);
            const [unauthorizedVaultAta] = getVaultAtaPda(unauthorizedVaultPda);
            const { getAssociatedTokenAddress } = await import("@solana/spl-token");
            const unauthorizedEmployerAta = await getAssociatedTokenAddress(
                ctx.allowedMint,
                unauthorizedUser.publicKey
            );

            try {
                await ctx.program.methods
                    .withdraw(new BN(1000))
                    .accountsPartial({
                        employer: unauthorizedUser.publicKey,
                        vaultAta: unauthorizedVaultAta,
                        employerAta: unauthorizedEmployerAta,
                        tokenMint: ctx.allowedMint,
                    })
                    .signers([unauthorizedUser])
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                const errorCode = getErrorCode(err);
                expect(err).to.not.be.null;
            }
        });
    });
});

