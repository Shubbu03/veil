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
    getSchedulePda,
    randomId,
    getErrorCode,
} from "./helpers";

describe("Schedule Instructions", () => {
    let ctx: TestContext;
    let employerWithVault: Keypair;
    let vaultPda: PublicKey;

    before(async () => {
        ctx = await createTestContext();
        await ensureConfigInitialized(ctx);
        await ensureUnpaused(ctx);

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

        const employerAta = await setupEmployerWithTokens(ctx, employerWithVault.publicKey, 1_000_000);
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

    describe("create_schedule", () => {
        it("Should create schedule successfully", async () => {
            const scheduleId = randomId();
            const [schedulePda] = getSchedulePda(vaultPda, scheduleId);
            const intervalSecs = 86400;
            const reservedAmount = 100_000;
            const perExecutionAmount = 10_000;
            const merkleRoot = randomId();
            const totalRecipients = 10;
            const erJobId = randomId();

            await ctx.program.methods
                .createSchedule(
                    scheduleId,
                    new BN(intervalSecs),
                    new BN(reservedAmount),
                    new BN(perExecutionAmount),
                    merkleRoot,
                    totalRecipients,
                    erJobId
                )
                .accountsPartial({
                    employer: employerWithVault.publicKey,
                })
                .signers([employerWithVault])
                .rpc();

            const schedule = await ctx.program.account.scheduleAccount.fetch(schedulePda);
            expect(schedule.employer.toString()).to.equal(employerWithVault.publicKey.toString());
            expect(schedule.vault.toString()).to.equal(vaultPda.toString());
            expect(schedule.intervalSecs.toNumber()).to.equal(intervalSecs);
            expect(schedule.reservedAmount.toNumber()).to.equal(reservedAmount);
            expect(schedule.perExecutionAmount.toNumber()).to.equal(perExecutionAmount);
            expect(schedule.totalRecipients).to.equal(totalRecipients);
            expect(schedule.paidCount).to.equal(0);

            const vault = await ctx.program.account.vaultAccount.fetch(vaultPda);
            expect(vault.reserved.toNumber()).to.equal(reservedAmount);
        });

        it("Should fail with insufficient funds", async () => {
            const scheduleId = randomId();
            const vault = await ctx.program.account.vaultAccount.fetch(vaultPda);
            const reservedAmount = vault.available.toNumber() + 1;
            const merkleRoot = randomId();
            const erJobId = randomId();

            try {
                await ctx.program.methods
                    .createSchedule(
                        scheduleId,
                        new BN(86400),
                        new BN(reservedAmount),
                        new BN(10_000),
                        merkleRoot,
                        10,
                        erJobId
                    )
                    .accountsPartial({
                        employer: employerWithVault.publicKey,
                    })
                    .signers([employerWithVault])
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                const errorCode = getErrorCode(err);
                expect(errorCode).to.equal("InsufficientFunds");
            }
        });

        it("Should fail with zero interval_secs", async () => {
            const scheduleId = randomId();
            const merkleRoot = randomId();
            const erJobId = randomId();

            try {
                await ctx.program.methods
                    .createSchedule(
                        scheduleId,
                        new BN(0),
                        new BN(1000),
                        new BN(100),
                        merkleRoot,
                        10,
                        erJobId
                    )
                    .accountsPartial({
                        employer: employerWithVault.publicKey,
                    })
                    .signers([employerWithVault])
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                const errorCode = getErrorCode(err);
                expect(errorCode).to.equal("InvalidScheduleId");
            }
        });

        it("Should fail with zero reserved_amount", async () => {
            const scheduleId = randomId();
            const merkleRoot = randomId();
            const erJobId = randomId();

            try {
                await ctx.program.methods
                    .createSchedule(
                        scheduleId,
                        new BN(86400),
                        new BN(0),
                        new BN(100),
                        merkleRoot,
                        10,
                        erJobId
                    )
                    .accountsPartial({
                        employer: employerWithVault.publicKey,
                    })
                    .signers([employerWithVault])
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                const errorCode = getErrorCode(err);
                expect(errorCode).to.equal("InsufficientFunds");
            }
        });

        it("Should fail with zero total_recipients", async () => {
            const scheduleId = randomId();
            const merkleRoot = randomId();
            const erJobId = randomId();

            try {
                await ctx.program.methods
                    .createSchedule(
                        scheduleId,
                        new BN(86400),
                        new BN(1000),
                        new BN(100),
                        merkleRoot,
                        0,
                        erJobId
                    )
                    .accountsPartial({
                        employer: employerWithVault.publicKey,
                    })
                    .signers([employerWithVault])
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                const errorCode = getErrorCode(err);
                expect(errorCode).to.equal("InvalidMaxRecipients");
            }
        });

        it("Should fail if program is paused", async () => {
            const scheduleId = randomId();
            const merkleRoot = randomId();
            const erJobId = randomId();

            await ctx.program.methods
                .pause()
                .accountsPartial({ governance: ctx.governance.publicKey })
                .signers([ctx.governance])
                .rpc();

            try {
                await ctx.program.methods
                    .createSchedule(
                        scheduleId,
                        new BN(86400),
                        new BN(1000),
                        new BN(100),
                        merkleRoot,
                        10,
                        erJobId
                    )
                    .accountsPartial({
                        employer: employerWithVault.publicKey,
                    })
                    .signers([employerWithVault])
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

    describe("cancel_schedule", () => {
        let scheduleId: number[];
        let schedulePda: PublicKey;

        before(async () => {
            scheduleId = randomId();
            [schedulePda] = getSchedulePda(vaultPda, scheduleId);
            const merkleRoot = randomId();
            const erJobId = randomId();

            await ctx.program.methods
                .createSchedule(
                    scheduleId,
                    new BN(86400),
                    new BN(50_000),
                    new BN(5_000),
                    merkleRoot,
                    10,
                    erJobId
                )
                .accountsPartial({
                    employer: employerWithVault.publicKey,
                })
                .signers([employerWithVault])
                .rpc();
        });

        it("Should cancel schedule successfully", async () => {
            const vaultBefore = await ctx.program.account.vaultAccount.fetch(vaultPda);
            const scheduleBefore = await ctx.program.account.scheduleAccount.fetch(schedulePda);
            const reservedAmount = scheduleBefore.reservedAmount.toNumber();

            await ctx.program.methods
                .cancelSchedule()
                .accountsPartial({
                    employer: employerWithVault.publicKey,
                })
                .signers([employerWithVault])
                .rpc();

            const schedule = await ctx.program.account.scheduleAccount.fetch(schedulePda);
            expect(schedule.status).to.deep.equal({ cancelled: {} });

            const vaultAfter = await ctx.program.account.vaultAccount.fetch(vaultPda);
            expect(vaultAfter.reserved.toNumber()).to.equal(
                vaultBefore.reserved.toNumber() - reservedAmount
            );
            expect(vaultAfter.available.toNumber()).to.equal(
                vaultBefore.available.toNumber() + reservedAmount
            );
        });

        it("Should fail if schedule already cancelled", async () => {
            try {
                await ctx.program.methods
                    .cancelSchedule()
                    .accountsPartial({
                        employer: employerWithVault.publicKey,
                    })
                    .signers([employerWithVault])
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                const errorCode = getErrorCode(err);
                expect(errorCode).to.equal("ScheduleAlreadyCancelled");
            }
        });
    });

    describe("pause_schedule", () => {
        let scheduleId: number[];
        let schedulePda: PublicKey;

        before(async () => {
            scheduleId = randomId();
            [schedulePda] = getSchedulePda(vaultPda, scheduleId);
            const merkleRoot = randomId();
            const erJobId = randomId();

            await ctx.program.methods
                .createSchedule(
                    scheduleId,
                    new BN(86400),
                    new BN(50_000),
                    new BN(5_000),
                    merkleRoot,
                    10,
                    erJobId
                )
                .accountsPartial({
                    employer: employerWithVault.publicKey,
                })
                .signers([employerWithVault])
                .rpc();
        });

        it("Should pause schedule successfully", async () => {
            await ctx.program.methods
                .pauseSchedule(true)
                .accountsPartial({
                    employer: employerWithVault.publicKey,
                })
                .signers([employerWithVault])
                .rpc();

            const schedule = await ctx.program.account.scheduleAccount.fetch(schedulePda);
            expect(schedule.status).to.deep.equal({ paused: {} });
        });

        it("Should resume schedule successfully", async () => {
            await ctx.program.methods
                .pauseSchedule(false)
                .accountsPartial({
                    employer: employerWithVault.publicKey,
                })
                .signers([employerWithVault])
                .rpc();

            const schedule = await ctx.program.account.scheduleAccount.fetch(schedulePda);
            expect(schedule.status).to.deep.equal({ active: {} });
        });

        it("Should fail if already paused", async () => {
            await ctx.program.methods
                .pauseSchedule(true)
                .accountsPartial({
                    employer: employerWithVault.publicKey,
                })
                .signers([employerWithVault])
                .rpc();

            try {
                await ctx.program.methods
                    .pauseSchedule(true)
                    .accountsPartial({
                        employer: employerWithVault.publicKey,
                    })
                    .signers([employerWithVault])
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                const errorCode = getErrorCode(err);
                expect(errorCode).to.equal("ScheduleAlreadyPaused");
            }
        });
    });
});

