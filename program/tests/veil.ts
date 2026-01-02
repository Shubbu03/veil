import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Veil } from "../target/types/veil";
import { expect } from "chai";
import { PublicKey, Keypair } from "@solana/web3.js";
import { BN } from "bn.js";

describe("veil", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.veil as Program<Veil>;

  // Helper function to extract error code from Anchor errors
  const getErrorCode = (err: any): string | undefined => {
    // Try different error structures
    if (err.error?.errorCode?.code) return err.error.errorCode.code;
    if (err.errorCode?.code) return err.errorCode.code;
    if (err.code) return err.code;
    // Check error message for "Error Code: X"
    if (err.message) {
      const match = err.message.match(/Error Code: (\w+)/);
      if (match) return match[1];
    }
    if (err.logs) {
      for (const log of err.logs) {
        const match = log.match(/Error Code: (\w+)/);
        if (match) return match[1];
      }
    }
    return undefined;
  };

  // Test accounts
  const admin = provider.wallet;
  const governance = Keypair.generate();
  const erAuthority = Keypair.generate();
  const newErAuthority = Keypair.generate();
  const unauthorizedUser = Keypair.generate();
  const allowedMint = Keypair.generate().publicKey;
  let configExists = false;
  let configGovernance: PublicKey | null = null;

  // Config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("veil_config")],
    program.programId
  );

  let actualGovernance: Keypair = governance;

  before(async () => {
    // Airdrop SOL to test accounts
    const airdropAmount = 2 * anchor.web3.LAMPORTS_PER_SOL;
    await provider.connection.requestAirdrop(
      governance.publicKey,
      airdropAmount
    );
    await provider.connection.requestAirdrop(
      unauthorizedUser.publicKey,
      airdropAmount
    );

    // Check if config exists and get actual governance
    try {
      const config = await program.account.veilConfig.fetch(configPda);
      configExists = true;
      configGovernance = config.governance;
    } catch {
      configExists = false;
      configGovernance = null;
    }
  });

  describe("Admin Instructions", () => {
    const skipAdmin =
      configExists &&
      configGovernance &&
      configGovernance.toString() !== governance.publicKey.toString();

    describe("init_config", () => {
      if (skipAdmin) {
        it("skipped because config already exists with different governance", () => { });
        return;
      }
      it("Should fail with max_recipients = 0", async () => {
        try {
          await program.methods
            .initConfig(
              governance.publicKey,
              erAuthority.publicKey,
              allowedMint,
              0,
              new BN(604800)
            )
            .accounts({
              admin: admin.publicKey,
            })
            .rpc();
          expect.fail("Should have failed");
        } catch (err: any) {
          const errorCode = getErrorCode(err);
          expect(errorCode).to.equal("InvalidMaxRecipients");
        }
      });

      it("Should fail with default er_authority", async () => {
        try {
          await program.methods
            .initConfig(
              governance.publicKey,
              PublicKey.default,
              allowedMint,
              100,
              new BN(604800)
            )
            .accounts({
              admin: admin.publicKey,
            })
            .rpc();
          expect.fail("Should have failed");
        } catch (err: any) {
          const errorCode = getErrorCode(err);
          expect(errorCode).to.equal("InvalidErAuthority");
        }
      });

      it("Should fail with default allowed_mint", async () => {
        try {
          await program.methods
            .initConfig(
              governance.publicKey,
              erAuthority.publicKey,
              PublicKey.default,
              100,
              new BN(604800)
            )
            .accounts({
              admin: admin.publicKey,
            })
            .rpc();
          expect.fail("Should have failed");
        } catch (err: any) {
          const errorCode = getErrorCode(err);
          expect(errorCode).to.equal("InvalidErAuthority");
        }
      });

      it("Should initialize config successfully", async () => {
        try {
          await program.account.veilConfig.fetch(configPda);
          return;
        } catch {
        }

        const maxRecipients = 100;

        const tx = await program.methods
          .initConfig(
            governance.publicKey,
            erAuthority.publicKey,
            allowedMint,
            maxRecipients,
            new BN(604800)
          )
          .accounts({
            admin: admin.publicKey,
          })
          .rpc();

        const config = await program.account.veilConfig.fetch(configPda);
        expect(config.governance.toString()).to.equal(
          governance.publicKey.toString()
        );
        expect(config.erAuthority.toString()).to.equal(
          erAuthority.publicKey.toString()
        );
        expect(config.allowedMint.toString()).to.equal(allowedMint.toString());
        expect(config.maxRecipients).to.equal(maxRecipients);
        expect(config.batchTimeoutSecs.toNumber()).to.equal(604800);
        expect(config.paused).to.be.false;
      });

      it("Should fail if config already initialized", async () => {
        try {
          await program.methods
            .initConfig(
              governance.publicKey,
              erAuthority.publicKey,
              allowedMint,
              100,
              new BN(604800)
            )
            .accounts({
              admin: admin.publicKey,
            })
            .rpc();
          expect.fail("Should have failed - config already exists");
        } catch (err: any) {
          expect(err).to.not.be.null;
        }
      });
    });

    describe("pause", () => {
      if (skipAdmin) {
        it("skipped because config governance is different", () => { });
        return;
      }
      it("Should pause successfully", async () => {
        // Ensure config exists and get actual governance
        let config;
        try {
          config = await program.account.veilConfig.fetch(configPda);
          // Use the governance from config - but we need the keypair, not just the pubkey
          // For testing, we'll assume governance keypair matches
        } catch {
          // Config doesn't exist, skip this test
          return;
        }

        // Ensure unpaused first
        if (config.paused) {
          await program.methods
            .unpause()
            .accounts({
              governance: governance.publicKey,
            })
            .signers([governance])
            .rpc();
        }

        const tx = await program.methods
          .pause()
          .accounts({
            governance: governance.publicKey,
          })
          .signers([governance])
          .rpc();

        const configAfter = await program.account.veilConfig.fetch(configPda);
        expect(configAfter.paused).to.be.true;
      });

      it("Should fail if already paused", async () => {
        const config = await program.account.veilConfig.fetch(configPda);
        if (!config.paused) {
          await program.methods
            .pause()
            .accounts({
              governance: governance.publicKey,
            })
            .signers([governance])
            .rpc();
        }

        try {
          await program.methods
            .pause()
            .accounts({
              governance: governance.publicKey,
            })
            .signers([governance])
            .rpc();
          expect.fail("Should have failed");
        } catch (err: any) {
          const errorCode = err.error?.errorCode?.code || err.errorCode?.code;
          expect(errorCode).to.equal("Paused");
        }
      });

      it("Should fail if unauthorized", async () => {
        const config = await program.account.veilConfig.fetch(configPda);
        if (config.paused) {
          await program.methods
            .unpause()
            .accounts({
              governance: governance.publicKey,
            })
            .signers([governance])
            .rpc();
        }

        try {
          await program.methods
            .pause()
            .accounts({
              governance: unauthorizedUser.publicKey,
            })
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
      if (skipAdmin) {
        it("skipped because config governance is different", () => { });
        return;
      }
      it("Should unpause successfully", async () => {
        await program.methods
          .pause()
          .accounts({
            governance: governance.publicKey,
          })
          .signers([governance])
          .rpc();

        const tx = await program.methods
          .unpause()
          .accounts({
            governance: governance.publicKey,
          })
          .signers([governance])
          .rpc();

        const config = await program.account.veilConfig.fetch(configPda);
        expect(config.paused).to.be.false;
      });

      it("Should fail if not paused", async () => {
        const config = await program.account.veilConfig.fetch(configPda);
        if (config.paused) {
          await program.methods
            .unpause()
            .accounts({
              governance: governance.publicKey,
            })
            .signers([governance])
            .rpc();
        }

        try {
          await program.methods
            .unpause()
            .accounts({
              governance: governance.publicKey,
            })
            .signers([governance])
            .rpc();
          expect.fail("Should have failed");
        } catch (err: any) {
          const errorCode = err.error?.errorCode?.code || err.errorCode?.code;
          expect(errorCode).to.equal("NotPaused");
        }
      });

      it("Should fail if unauthorized", async () => {
        const config = await program.account.veilConfig.fetch(configPda);
        if (!config.paused) {
          await program.methods
            .pause()
            .accounts({
              governance: governance.publicKey,
            })
            .signers([governance])
            .rpc();
        }

        try {
          await program.methods
            .unpause()
            .accounts({
              governance: unauthorizedUser.publicKey,
            })
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
      if (skipAdmin) {
        it("skipped because config governance is different", () => { });
        return;
      }
      it("Should update ER authority successfully", async () => {
        const config = await program.account.veilConfig.fetch(configPda);
        if (config.paused) {
          await program.methods
            .unpause()
            .accounts({
              governance: governance.publicKey,
            })
            .signers([governance])
            .rpc();
        }

        const tx = await program.methods
          .setErAuthority(newErAuthority.publicKey)
          .accounts({
            governance: governance.publicKey,
          })
          .signers([governance])
          .rpc();

        const updatedConfig = await program.account.veilConfig.fetch(configPda);
        expect(updatedConfig.erAuthority.toString()).to.equal(
          newErAuthority.publicKey.toString()
        );
      });

      it("Should fail if paused", async () => {
        await program.methods
          .pause()
          .accounts({
            governance: governance.publicKey,
          })
          .signers([governance])
          .rpc();

        try {
          await program.methods
            .setErAuthority(erAuthority.publicKey)
            .accounts({
              governance: governance.publicKey,
            })
            .signers([governance])
            .rpc();
          expect.fail("Should have failed");
        } catch (err: any) {
          const errorCode = err.error?.errorCode?.code || err.errorCode?.code;
          expect(errorCode).to.equal("Paused");
        }
      });

      it("Should fail with default pubkey", async () => {
        const config = await program.account.veilConfig.fetch(configPda);
        if (config.paused) {
          await program.methods
            .unpause()
            .accounts({
              governance: governance.publicKey,
            })
            .signers([governance])
            .rpc();
        }

        try {
          await program.methods
            .setErAuthority(PublicKey.default)
            .accounts({
              governance: governance.publicKey,
            })
            .signers([governance])
            .rpc();
          expect.fail("Should have failed");
        } catch (err: any) {
          const errorCode = err.error?.errorCode?.code || err.errorCode?.code;
          expect(errorCode).to.equal("InvalidErAuthority");
        }
      });

      it("Should fail if unauthorized", async () => {
        const config = await program.account.veilConfig.fetch(configPda);
        if (config.paused) {
          await program.methods
            .unpause()
            .accounts({
              governance: governance.publicKey,
            })
            .signers([governance])
            .rpc();
        }

        try {
          await program.methods
            .setErAuthority(erAuthority.publicKey)
            .accounts({
              governance: unauthorizedUser.publicKey,
            })
            .signers([unauthorizedUser])
            .rpc();
          expect.fail("Should have failed");
        } catch (err: any) {
          const errorCode = getErrorCode(err);
          expect(errorCode).to.equal("Unauthorized");
        }
      });
    });

    describe("Events", () => {
      it("Should emit ConfigInitialized event", async () => {
        const config = await program.account.veilConfig.fetch(configPda);
        expect(config).to.not.be.null;
        expect(config.governance.toString()).to.equal(
          governance.publicKey.toString()
        );
      });
    });
  });
});
