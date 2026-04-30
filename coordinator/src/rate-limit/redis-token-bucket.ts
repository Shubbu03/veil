import { createClient } from "redis";
import { createLogger } from "../logger";
import { REDIS_TOKEN_BUCKET_SCRIPT } from "./redis-token-bucket-script";
import { RateLimitPolicyName, TokenBucketDecision, TokenBucketPolicy } from "./types";

const logger = createLogger("rate-limit-redis");

export class RedisTokenBucketLimiter {
    private client: ReturnType<typeof createClient> | null = null;
    private connectPromise: Promise<ReturnType<typeof createClient>> | null = null;

    constructor(
        private readonly redisUrl: string,
        private readonly policyName: RateLimitPolicyName,
        private readonly policy: TokenBucketPolicy,
        private readonly keyPrefix: string
    ) {}

    async consume(key: string, cost = 1): Promise<TokenBucketDecision> {
        const client = await this.getClient();
        const storageKey = `${this.keyPrefix}:${this.policyName}:${key}`;
        const ttlSeconds = this.computeTtlSeconds();

        const rawResult = await client.eval(REDIS_TOKEN_BUCKET_SCRIPT, {
            keys: [storageKey],
            arguments: [
                String(Date.now()),
                String(this.policy.refillRatePerSecond),
                String(this.policy.capacity),
                String(cost),
                String(ttlSeconds * 1000),
            ],
        });

        const [allowed, remaining, retryAfterSeconds] = this.parseResult(rawResult);

        return {
            allowed: allowed === 1,
            remaining,
            retryAfterSeconds,
        };
    }

    async disconnect() {
        this.connectPromise = null;

        if (!this.client) {
            return;
        }

        const activeClient = this.client;
        this.client = null;

        if (activeClient.isOpen) {
            await activeClient.quit();
        }
    }

    private async getClient(): Promise<ReturnType<typeof createClient>> {
        if (this.client?.isReady) {
            return this.client;
        }

        if (this.connectPromise) {
            return this.connectPromise;
        }

        this.connectPromise = this.connect();

        try {
            const client = await this.connectPromise;
            this.client = client;
            return client;
        } finally {
            this.connectPromise = null;
        }
    }

    private async connect(): Promise<ReturnType<typeof createClient>> {
        const client = createClient({ url: this.redisUrl });

        client.on("error", (error) => {
            logger.error({ err: error, policy: this.policyName }, "Redis limiter client error");
        });

        client.on("end", () => {
            if (this.client === client) {
                this.client = null;
            }
        });

        await client.connect();
        logger.info({ policy: this.policyName }, "Redis limiter client connected");
        return client;
    }

    private computeTtlSeconds() {
        const minimumRefillRate = Math.max(this.policy.refillRatePerSecond, 0.0001);
        return Math.max(60, Math.ceil((this.policy.capacity / minimumRefillRate) * 2));
    }

    private parseResult(rawResult: unknown): [number, number, number] {
        if (!Array.isArray(rawResult) || rawResult.length < 3) {
            throw new Error(`Unexpected Redis token bucket response: ${JSON.stringify(rawResult)}`);
        }

        return rawResult.slice(0, 3).map((value) => Number(value)) as [number, number, number];
    }
}
