import express, { Request, Response } from "express";
import { recipientStore } from "./store";
import { ScheduleRecipientData } from "./types";
import { executionRepository } from "./db/execution-repository";
import {
    RegistrationValidationError,
    RegisterScheduleRequest,
    validateScheduleRegistration,
} from "./registration";
import { createLogger } from "./logger";
import {
    apiRequestDurationSeconds,
    apiRequestsTotal,
    metricsRegistry,
} from "./metrics";

const router = express.Router();
const logger = createLogger("api");

router.use((req, res, next) => {
    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
        const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
        const route = req.route?.path || req.path || "unknown";
        const statusCode = String(res.statusCode);

        apiRequestsTotal.inc({
            method: req.method,
            route,
            status_code: statusCode,
        });
        apiRequestDurationSeconds.observe(
            {
                method: req.method,
                route,
            },
            durationSeconds
        );

        logger.info(
            {
                method: req.method,
                path: req.originalUrl,
                route,
                statusCode: res.statusCode,
                durationMs: Math.round(durationSeconds * 1000),
            },
            "Handled API request"
        );
    });

    next();
});


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

        logger.info(
            {
                schedulePda: validated.schedulePda,
                recipientCount: validated.recipients.length,
            },
            "Registered schedule recipient data"
        );

        res.json({
            success: true,
            schedulePda: validated.schedulePda,
            merkleRoot: validated.merkleRoot,
        });
    } catch (error: any) {
        if (error instanceof RegistrationValidationError) {
            logger.warn({ path: req.originalUrl, error: error.message }, "Schedule registration rejected");
            return res.status(error.statusCode).json({
                error: error.message,
            });
        }
        logger.error({ err: error }, "Error registering schedule");
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
        logger.error({ err: error, schedulePda: req.params.schedulePda }, "Error fetching schedule");
        res.status(500).json({
            error: error.message || "Failed to fetch schedule",
        });
    }
});

router.get("/schedules/:schedulePda/payload", async (req: Request, res: Response) => {
    try {
        const { schedulePda } = req.params;
        const data = await recipientStore.get(schedulePda);

        if (!data) {
            return res.status(404).json({ error: "Schedule payload not found" });
        }

        res.json({
            schedulePda: data.schedulePda,
            scheduleId: data.scheduleId,
            vaultEmployer: data.vaultEmployer,
            tokenMint: data.tokenMint,
            recipients: data.recipients.map((recipient) => ({
                address: recipient.address.toBase58(),
                amount: recipient.amount.toString(),
            })),
            merkleRoot: data.merkleRoot,
            createdAt: data.createdAt,
        });
    } catch (error: any) {
        logger.error({ err: error, schedulePda: req.params.schedulePda }, "Error fetching schedule payload");
        res.status(500).json({
            error: error.message || "Failed to fetch schedule payload",
        });
    }
});

router.get("/schedules/:schedulePda/executions", async (req: Request, res: Response) => {
    try {
        const { schedulePda } = req.params;
        const rawLimit = Number.parseInt(String(req.query.limit ?? "10"), 10);
        const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 25) : 10;
        const runs = await executionRepository.listRunsForSchedule(schedulePda, limit);

        res.json({
            schedulePda,
            runs,
        });
    } catch (error: any) {
        logger.error({ err: error, schedulePda: req.params.schedulePda }, "Error fetching execution history");
        res.status(500).json({
            error: error.message || "Failed to fetch execution history",
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
        logger.error({ err: error }, "Error in health check");
        const isDbError = error.message?.includes("connection") || error.message?.includes("timeout");
        res.status(isDbError ? 503 : 500).json({
            status: "unhealthy",
            database: "disconnected",
            timestamp: Date.now(),
            error: error.message || "Health check failed",
        });
    }
});

router.get("/metrics", async (_req: Request, res: Response) => {
    res.set("Content-Type", metricsRegistry.contentType);
    res.send(await metricsRegistry.metrics());
});

export default router;
