import express, { Request, Response } from "express";
import { recipientStore } from "./store";
import { ScheduleRecipientData } from "./types";
import {
    RegistrationValidationError,
    RegisterScheduleRequest,
    validateScheduleRegistration,
} from "./registration";

const router = express.Router();


// Register a schedule with recipient data
router.post("/schedules", async (req: Request, res: Response) => {
    try {
        const validated = await validateScheduleRegistration(req.body as RegisterScheduleRequest);

        const data: ScheduleRecipientData = {
            schedulePda: validated.schedulePda,
            scheduleId: validated.scheduleId,
            vaultEmployer: validated.vaultEmployer,
            tokenMint: validated.tokenMint,
            recipients: validated.recipients,
            proofs: validated.proofs,
            merkleRoot: validated.merkleRoot,
            createdAt: Date.now(),
        };

        await recipientStore.set(validated.schedulePda, data);

        res.json({
            success: true,
            schedulePda: validated.schedulePda,
            merkleRoot: validated.merkleRoot,
        });
    } catch (error: any) {
        if (error instanceof RegistrationValidationError) {
            return res.status(error.statusCode).json({
                error: error.message,
            });
        }
        console.error("Error registering schedule:", error);
        res.status(500).json({
            error: error.message || "Failed to register schedule",
        });
    }
});

// Get recipient data for a schedule
router.get("/schedules/:schedulePda", async (req: Request, res: Response) => {
    try {
        const { schedulePda } = req.params;
        const data = await recipientStore.get(schedulePda);

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
    } catch (error: any) {
        console.error("Error fetching schedule:", error);
        res.status(500).json({
            error: error.message || "Failed to fetch schedule",
        });
    }
});

router.get("/health", async (_req: Request, res: Response) => {
    try {
        const { db } = await import("./db");
        const { sql } = await import("drizzle-orm");
        await db.execute(sql`SELECT 1`);

        const allSchedules = await recipientStore.getAll();
        res.json({
            status: "healthy",
            database: "connected",
            timestamp: Date.now(),
            schedulesRegistered: allSchedules.length,
        });
    } catch (error: any) {
        console.error("Error in health check:", error);
        const isDbError = error.message?.includes("connection") || error.message?.includes("timeout");
        res.status(isDbError ? 503 : 500).json({
            status: "unhealthy",
            database: "disconnected",
            timestamp: Date.now(),
            error: error.message || "Health check failed",
        });
    }
});

export default router;
