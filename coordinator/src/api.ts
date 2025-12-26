import express, { Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";
import { recipientStore } from "./store";
import { ScheduleRecipientData } from "./types";
import { buildMerkleTree, Recipient } from "@veil/sdk";

const router = express.Router();


// Register a schedule with recipient data
router.post("/schedules", async (req: Request, res: Response) => {
    try {
        const {
            schedulePda,
            scheduleId,
            vaultEmployer,
            tokenMint,
            recipients,
        }: {
            schedulePda: string;
            scheduleId: number[];
            vaultEmployer: string;
            tokenMint: string;
            recipients: Array<{ address: string; amount: string }>;
        } = req.body;

        if (!schedulePda || !scheduleId || !vaultEmployer || !tokenMint || !recipients) {
            return res.status(400).json({
                error: "Missing required fields: schedulePda, scheduleId, vaultEmployer, tokenMint, recipients",
            });
        }

        const recipientList: Recipient[] = recipients.map((r) => ({
            address: new PublicKey(r.address),
            amount: BigInt(r.amount),
        }));

        const { root, proofs } = buildMerkleTree(recipientList);

        const data: ScheduleRecipientData = {
            schedulePda,
            scheduleId,
            vaultEmployer,
            tokenMint,
            recipients: recipientList,
            proofs,
            merkleRoot: Array.from(root),
            createdAt: Date.now(),
        };

        recipientStore.set(schedulePda, data);

        console.log(`✅ Registered schedule ${schedulePda} with ${recipients.length} recipients`);

        res.json({
            success: true,
            schedulePda,
            merkleRoot: Array.from(root),
        });
    } catch (error: any) {
        console.error("Error registering schedule:", error);
        res.status(500).json({
            error: error.message || "Failed to register schedule",
        });
    }
});

// Get recipient data for a schedule
router.get("/schedules/:schedulePda", (req: Request, res: Response) => {
    const { schedulePda } = req.params;
    const data = recipientStore.get(schedulePda);

    if (!data) {
        return res.status(404).json({ error: "Schedule not found" });
    }

    res.json({
        schedulePda: data.schedulePda,
        scheduleId: data.scheduleId,
        vaultEmployer: data.vaultEmployer,
        recipientCount: data.recipients.length,
        merkleRoot: data.merkleRoot,
        createdAt: data.createdAt,
    });
});

router.get("/health", (_req: Request, res: Response) => {
    res.json({
        status: "ok",
        timestamp: Date.now(),
        schedulesRegistered: recipientStore.getAll().length,
    });
});

export default router;

