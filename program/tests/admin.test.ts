import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
    createTestContext,
    ensureConfigInitialized,
    ensureUnpaused,
    ensurePaused,
    TestContext,
    getErrorCode,
} from "./helpers";

describe("Admin Instructions", () => {
    let ctx: TestContext;
    let unauthorizedUser: Keypair;
    let newErAuthority: Keypair;

    before(async () => {
        ctx = await createTestContext();
        unauthorizedUser = Keypair.generate();
        newErAuthority = Keypair.generate();

        await ctx.provider.connection.requestAirdrop(
            unauthorizedUser.publicKey,
            2 * anchor.web3.LAMPORTS_PER_SOL
        );
        await ctx.provider.connection.confirmTransaction(
            await ctx.provider.connection.requestAirdrop(
                newErAuthority.publicKey,
                2 * anchor.web3.LAMPORTS_PER_SOL
            ),
            "confirmed"
        );
    });

    describe("init_config", () => {
        it("Should fail with max_recipients = 0", async () => {
            try {
                await ctx.program.methods
                    .initConfig(
                        ctx.governance.publicKey,
                        ctx.erAuthority.publicKey,
                        ctx.allowedMint,
                        0
                    )
                    .accountsPartial({ admin: ctx.admin.publicKey })
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                const errorCode = getErrorCode(err);
                expect(errorCode).to.equal("InvalidMaxRecipients");
            }
        });

        it("Should fail with default er_authority", async () => {
            try {
                await ctx.program.methods
                    .initConfig(
                        ctx.governance.publicKey,
                        PublicKey.default,
                        ctx.allowedMint,
                        100
                    )
                    .accountsPartial({ admin: ctx.admin.publicKey })
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                const errorCode = getErrorCode(err);
                expect(errorCode).to.equal("InvalidErAuthority");
            }
        });

        it("Should fail with default allowed_mint", async () => {
            try {
                await ctx.program.methods
                    .initConfig(
                        ctx.governance.publicKey,
                        ctx.erAuthority.publicKey,
                        PublicKey.default,
                        100
                    )
                    .accountsPartial({ admin: ctx.admin.publicKey })
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                const errorCode = getErrorCode(err);
                expect(errorCode).to.equal("InvalidErAuthority");
            }
        });

        it("Should initialize config successfully", async () => {
            try {
                await ctx.program.account.veilConfig.fetch(ctx.configPda);
                return;
            } catch {
            }

            const maxRecipients = 100;

            await ctx.program.methods
                .initConfig(
                    ctx.governance.publicKey,
                    ctx.erAuthority.publicKey,
                    ctx.allowedMint,
                    maxRecipients
                )
                .accountsPartial({ admin: ctx.admin.publicKey })
                .rpc();

            const config = await ctx.program.account.veilConfig.fetch(ctx.configPda);
            expect(config.governance.toString()).to.equal(
                ctx.governance.publicKey.toString()
            );
            expect(config.erAuthority.toString()).to.equal(
                ctx.erAuthority.publicKey.toString()
            );
            expect(config.allowedMint.toString()).to.equal(ctx.allowedMint.toString());
            expect(config.maxRecipients).to.equal(maxRecipients);
            expect(config.paused).to.be.false;
        });

        it("Should fail if config already initialized", async () => {
            try {
                await ctx.program.methods
                    .initConfig(
                        ctx.governance.publicKey,
                        ctx.erAuthority.publicKey,
                        ctx.allowedMint,
                        100
                    )
                    .accountsPartial({ admin: ctx.admin.publicKey })
                    .rpc();
                expect.fail("Should have failed - config already exists");
            } catch (err: any) {
                expect(err).to.not.be.null;
            }
        });
    });

    describe("pause", () => {
        before(async () => {
            await ensureConfigInitialized(ctx);
            await ensureUnpaused(ctx);
        });

        it("Should pause successfully", async () => {
            await ctx.program.methods
                .pause()
                .accountsPartial({ governance: ctx.governance.publicKey })
                .signers([ctx.governance])
                .rpc();

            const config = await ctx.program.account.veilConfig.fetch(ctx.configPda);
            expect(config.paused).to.be.true;
        });

        it("Should fail if already paused", async () => {
            try {
                await ctx.program.methods
                    .pause()
                    .accountsPartial({ governance: ctx.governance.publicKey })
                    .signers([ctx.governance])
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                const errorCode = getErrorCode(err);
                expect(errorCode).to.equal("Paused");
            }
        });

        it("Should fail if unauthorized", async () => {
            await ensureUnpaused(ctx);

            try {
                await ctx.program.methods
                    .pause()
                    .accountsPartial({ governance: unauthorizedUser.publicKey })
                    .signers([unauthorizedUser])
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                const errorCode = getErrorCode(err);
                expect(errorCode).to.equal("Unauthorized");
            }
        });
    });

    describe("unpause", () => {
        before(async () => {
            await ensureConfigInitialized(ctx);
            await ensurePaused(ctx);
        });

        it("Should unpause successfully", async () => {
            await ctx.program.methods
                .unpause()
                .accountsPartial({ governance: ctx.governance.publicKey })
                .signers([ctx.governance])
                .rpc();

            const config = await ctx.program.account.veilConfig.fetch(ctx.configPda);
            expect(config.paused).to.be.false;
        });

        it("Should fail if not paused", async () => {
            try {
                await ctx.program.methods
                    .unpause()
                    .accountsPartial({ governance: ctx.governance.publicKey })
                    .signers([ctx.governance])
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                const errorCode = getErrorCode(err);
                expect(errorCode).to.equal("NotPaused");
            }
        });

        it("Should fail if unauthorized", async () => {
            await ensurePaused(ctx);

            try {
                await ctx.program.methods
                    .unpause()
                    .accountsPartial({ governance: unauthorizedUser.publicKey })
                    .signers([unauthorizedUser])
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                const errorCode = getErrorCode(err);
                expect(errorCode).to.equal("Unauthorized");
            }
        });
    });

    describe("set_er_authority", () => {
        before(async () => {
            await ensureConfigInitialized(ctx);
            await ensureUnpaused(ctx);
        });

        it("Should update ER authority successfully", async () => {
            await ctx.program.methods
                .setErAuthority(newErAuthority.publicKey)
                .accountsPartial({ governance: ctx.governance.publicKey })
                .signers([ctx.governance])
                .rpc();

            const updatedConfig = await ctx.program.account.veilConfig.fetch(ctx.configPda);
            expect(updatedConfig.erAuthority.toString()).to.equal(
                newErAuthority.publicKey.toString()
            );
        });

        it("Should fail if paused", async () => {
            await ensurePaused(ctx);

            try {
                await ctx.program.methods
                    .setErAuthority(ctx.erAuthority.publicKey)
                    .accountsPartial({ governance: ctx.governance.publicKey })
                    .signers([ctx.governance])
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                const errorCode = getErrorCode(err);
                expect(errorCode).to.equal("Paused");
            }
        });

        it("Should fail with default pubkey", async () => {
            await ensureUnpaused(ctx);

            try {
                await ctx.program.methods
                    .setErAuthority(PublicKey.default)
                    .accountsPartial({ governance: ctx.governance.publicKey })
                    .signers([ctx.governance])
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                const errorCode = getErrorCode(err);
                expect(errorCode).to.equal("InvalidErAuthority");
            }
        });

        it("Should fail if unauthorized", async () => {
            await ensureUnpaused(ctx);

            try {
                await ctx.program.methods
                    .setErAuthority(ctx.erAuthority.publicKey)
                    .accountsPartial({ governance: unauthorizedUser.publicKey })
                    .signers([unauthorizedUser])
                    .rpc();
                expect.fail("Should have failed");
            } catch (err: any) {
                const errorCode = getErrorCode(err);
                expect(errorCode).to.equal("Unauthorized");
            }
        });
    });
});

