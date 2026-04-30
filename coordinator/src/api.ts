import express, { Request, Response } from "express";
import { recipientStore } from "./store";
import { RegisterSchedulePayload, ScheduleRecipientData } from "./types";
import { executionRepository } from "./db/execution-repository";
import {
    hasOversizedRecipientSet,
    isSameRegistrationPayload,
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
import { RateLimitService } from "./rate-limit";
import { buildIpKey, buildWalletKey } from "./rate-limit/keys";
import { config } from "./config";

const router = express.Router();
const logger = createLogger("api");
const rateLimitService = new RateLimitService({
    enabled: config.rateLimitEnabled,
    dryRun: config.rateLimitDryRun,
    redisUrl: config.rateLimitRedisUrl || undefined,
    redisKeyPrefix: config.rateLimitRedisKeyPrefix,
    registration: {
        capacity: config.rateLimitRegisterCapacity,
        refillRatePerSecond: config.rateLimitRegisterRefillRatePerSecond,
    },
    scheduleReads: {
        capacity: config.rateLimitScheduleReadCapacity,
        refillRatePerSecond: config.rateLimitScheduleReadRefillRatePerSecond,
    },
    executionHistoryReads: {
        capacity: config.rateLimitExecutionHistoryCapacity,
        refillRatePerSecond: config.rateLimitExecutionHistoryRefillRatePerSecond,
    },
    registrationConcurrency: config.rateLimitRegisterConcurrency,
});

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
router.post(
    "/schedules",
    rateLimitService.rateLimit({
        policyName: "register",
        resolveKey: (req) => {
            const wallet = typeof req.body?.vaultEmployer === "string" ? req.body.vaultEmployer.trim() : "";
            return wallet ? buildWalletKey("register", wallet) : buildIpKey("register", req);
        },
    }),
    rateLimitService.registrationConcurrency.bind(rateLimitService),
    async (req: Request, res: Response) => {
    try {
        const payload = req.body as Partial<RegisterSchedulePayload>;
        if (hasOversizedRecipientSet(payload, 1000)) {
            return res.status(400).json({
                error: "recipient count exceeds the current maximum",
            });
        }

        if (isComparableRegistrationPayload(payload) && payload.schedulePda) {
            const existing = await recipientStore.get(payload.schedulePda);
            if (existing && isSameRegistrationPayload(toComparablePayload(existing), payload)) {
                return res.json({
                    success: true,
                    schedulePda: existing.schedulePda,
                    merkleRoot: existing.merkleRoot,
                    alreadyRegistered: true,
                });
            }
        }

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
router.get(
    "/schedules/:schedulePda",
    rateLimitService.rateLimit({ policyName: "schedule-read" }),
    async (req: Request, res: Response) => {
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

router.get(
    "/schedules/:schedulePda/executions",
    rateLimitService.rateLimit({ policyName: "execution-history-read" }),
    async (req: Request, res: Response) => {
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

router.get("/metrics", async (req: Request, res: Response) => {
    if (!config.metricsEnabled) {
        return res.status(404).end();
    }

    if (!config.metricsPublic) {
        const authorization = req.headers.authorization;
        if (!config.metricsAuthToken || authorization !== `Bearer ${config.metricsAuthToken}`) {
            return res.status(403).json({ error: "Forbidden" });
        }
    }

    res.set("Content-Type", metricsRegistry.contentType);
    res.send(await metricsRegistry.metrics());
});

function toComparablePayload(data: ScheduleRecipientData): RegisterSchedulePayload {
    return {
        schedulePda: data.schedulePda,
        scheduleId: data.scheduleId,
        vaultEmployer: data.vaultEmployer,
        tokenMint: data.tokenMint,
        recipients: data.recipients.map((recipient) => ({
            address: recipient.address.toBase58(),
            amount: recipient.amount.toString(),
        })),
    };
}

function isComparableRegistrationPayload(payload: Partial<RegisterSchedulePayload>): payload is RegisterSchedulePayload {
    return (
        typeof payload.schedulePda === "string" &&
        Array.isArray(payload.scheduleId) &&
        typeof payload.vaultEmployer === "string" &&
        typeof payload.tokenMint === "string" &&
        Array.isArray(payload.recipients) &&
        payload.recipients.every(
            (recipient) =>
                recipient &&
                typeof recipient.address === "string" &&
                typeof recipient.amount === "string"
        )
    );
}

export default router;

export async function shutdownApiServices() {
    await rateLimitService.shutdown();
}
