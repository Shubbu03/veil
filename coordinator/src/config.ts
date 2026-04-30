import { config as dotenvConfig } from "dotenv";
import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

dotenvConfig();

function parseAllowedOrigins(value: string | undefined): "*" | string[] {
    const trimmed = value?.trim();
    if (!trimmed || trimmed === "*") {
        return "*";
    }

    return trimmed
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
}

function normalizeErRpcUrl(value: string | undefined): string {
    const trimmed = value?.trim();
    if (!trimmed) {
        return "https://devnet-as.magicblock.app/";
    }

    if (
        /^https?:\/\/devnet\.magicblock\.app\/?$/.test(trimmed) ||
        /^https?:\/\/rpc\.magicblock\.app\/devnet\/?$/.test(trimmed)
    ) {
        return "https://devnet-as.magicblock.app/";
    }

    return trimmed;
}

function parseClaimExecutionLayer(value: string | undefined): "solana" | "er" {
    return value?.trim().toLowerCase() === "er" ? "er" : "solana";
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) {
        return fallback;
    }

    if (["1", "true", "yes", "on"].includes(normalized)) {
        return true;
    }

    if (["0", "false", "no", "off"].includes(normalized)) {
        return false;
    }

    return fallback;
}

function parseInteger(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNumber(value: string | undefined, fallback: number): number {
    const parsed = Number(value ?? "");
    return Number.isFinite(parsed) ? parsed : fallback;
}

function loadKeypair(keypairPath: string): Keypair {
    const resolved = path.resolve(keypairPath);
    if (!fs.existsSync(resolved)) {
        throw new Error(`Keypair file not found: ${resolved}`);
    }
    return parseKeypairJson(fs.readFileSync(resolved, "utf-8"), `file:${resolved}`);
}

function parseKeypairJson(raw: string, source: string): Keypair {
    const trimmed = raw.trim();
    if (!trimmed) {
        throw new Error(`ER authority keypair payload is empty (${source})`);
    }

    let secretKey: unknown;
    try {
        secretKey = JSON.parse(trimmed);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to parse ER authority keypair JSON from ${source}: ${message}`);
    }

    if (
        !Array.isArray(secretKey) ||
        secretKey.length === 0 ||
        secretKey.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
    ) {
        throw new Error(`Invalid ER authority keypair payload from ${source}`);
    }

    return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

function loadKeypairFromEnv(): Keypair | null {
    const rawJson = process.env.ER_AUTHORITY_KEYPAIR_JSON;
    if (rawJson && rawJson.trim()) {
        return parseKeypairJson(rawJson, "env:ER_AUTHORITY_KEYPAIR_JSON");
    }

    const rawBase64 = process.env.ER_AUTHORITY_KEYPAIR_B64;
    if (rawBase64 && rawBase64.trim()) {
        let decoded: string;
        try {
            decoded = Buffer.from(rawBase64.trim(), "base64").toString("utf-8");
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to decode ER_AUTHORITY_KEYPAIR_B64: ${message}`);
        }

        return parseKeypairJson(decoded, "env:ER_AUTHORITY_KEYPAIR_B64");
    }

    return null;
}

export const config = {
    solanaRpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    claimExecutionLayer: parseClaimExecutionLayer(process.env.CLAIM_EXECUTION_LAYER),

    erRpcUrl: normalizeErRpcUrl(process.env.ER_RPC_URL),
    erValidator: process.env.ER_VALIDATOR || "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57",
    getErAuthorityKeypair: () => {
        const keypairFromEnv = loadKeypairFromEnv();
        if (keypairFromEnv) {
            return keypairFromEnv;
        }

        const keypairPath = process.env.ER_AUTHORITY_KEYPAIR_PATH || "./er-authority-keypair.json";
        return loadKeypair(keypairPath);
    },

    port: parseInteger(process.env.PORT, 3001),
    corsAllowedOrigins: parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS),
    pollIntervalMs: parseInteger(process.env.POLL_INTERVAL_MS, 60000),
    maxExecutionAttempts: parseInteger(process.env.MAX_EXECUTION_ATTEMPTS, 5),
    retryBaseDelayMs: parseInteger(process.env.RETRY_BASE_DELAY_MS, 30000),
    retryMaxDelayMs: parseInteger(process.env.RETRY_MAX_DELAY_MS, 7200000),
    maxRunnableExecutionsPerPoll: parseInteger(
        process.env.MAX_RUNNABLE_EXECUTIONS_PER_POLL,
        10
    ),
    jsonBodyLimit: process.env.API_JSON_LIMIT || "1mb",
    metricsEnabled: parseBoolean(process.env.METRICS_ENABLED, true),
    metricsPublic: parseBoolean(process.env.METRICS_PUBLIC, false),
    metricsAuthToken: process.env.METRICS_AUTH_TOKEN?.trim() || "",
    rateLimitEnabled: parseBoolean(process.env.RATE_LIMIT_ENABLED, true),
    rateLimitDryRun: parseBoolean(process.env.RATE_LIMIT_DRY_RUN, false),
    rateLimitRedisUrl: process.env.RATE_LIMIT_REDIS_URL?.trim() || "",
    rateLimitRedisKeyPrefix: process.env.RATE_LIMIT_REDIS_KEY_PREFIX?.trim() || "veil:rate-limit",
    rateLimitRegisterCapacity: parseInteger(process.env.RATE_LIMIT_REGISTER_CAPACITY, 5),
    rateLimitRegisterRefillRatePerSecond: parseNumber(
        process.env.RATE_LIMIT_REGISTER_REFILL_RATE_PER_SECOND,
        1 / 600
    ),
    rateLimitRegisterConcurrency: parseInteger(process.env.RATE_LIMIT_REGISTER_CONCURRENCY, 3),
    rateLimitScheduleReadCapacity: parseInteger(process.env.RATE_LIMIT_SCHEDULE_READ_CAPACITY, 60),
    rateLimitScheduleReadRefillRatePerSecond: parseNumber(
        process.env.RATE_LIMIT_SCHEDULE_READ_REFILL_RATE_PER_SECOND,
        1
    ),
    rateLimitExecutionHistoryCapacity: parseInteger(
        process.env.RATE_LIMIT_EXECUTION_HISTORY_CAPACITY,
        30
    ),
    rateLimitExecutionHistoryRefillRatePerSecond: parseNumber(
        process.env.RATE_LIMIT_EXECUTION_HISTORY_REFILL_RATE_PER_SECOND,
        1
    ),
} as const;
