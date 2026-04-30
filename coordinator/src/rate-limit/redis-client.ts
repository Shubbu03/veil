import { createClient } from "redis";
import { createLogger } from "../logger";
import { REDIS_TOKEN_BUCKET_SCRIPT } from "./redis-token-bucket-script";

const logger = createLogger("rate-limit-redis");

export class RateLimitRedisClient {
    private client: ReturnType<typeof createClient> | null = null;
    private connectPromise: Promise<ReturnType<typeof createClient>> | null = null;
    private hasConnected = false;
    private lastLoggedErrorAtMs = 0;

    constructor(private readonly redisUrl: string) {}

    async evalTokenBucket(keys: string[], args: string[]) {
        const client = await this.getClient();
        return client.eval(REDIS_TOKEN_BUCKET_SCRIPT, {
            keys,
            arguments: args,
        });
    }

    async disconnect() {
        this.connectPromise = null;

        if (!this.client) {
            return;
        }

        const activeClient = this.client;
        this.client = null;
        this.hasConnected = false;

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
        if (!this.client) {
            this.client = this.createRedisClient();
        }

        await this.client.connect();
        this.hasConnected = true;
        logger.info("Redis limiter client connected");
        return this.client;
    }

    private createRedisClient() {
        const client = createClient({ url: this.redisUrl });

        client.on("error", (error) => {
            const now = Date.now();
            const shouldLog = this.hasConnected || now - this.lastLoggedErrorAtMs >= 15_000;

            if (!shouldLog) {
                return;
            }

            this.lastLoggedErrorAtMs = now;
            logger.warn({ err: error }, "Redis limiter client connection issue");
        });

        client.on("end", () => {
            this.hasConnected = false;
            this.connectPromise = null;
        });

        return client;
    }
}
