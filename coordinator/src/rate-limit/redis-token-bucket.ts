import { RateLimitPolicyName, TokenBucketDecision, TokenBucketPolicy } from "./types";
import { RateLimitRedisClient } from "./redis-client";

export class RedisTokenBucketLimiter {
    constructor(
        private readonly redisClient: RateLimitRedisClient,
        private readonly policyName: RateLimitPolicyName,
        private readonly policy: TokenBucketPolicy,
        private readonly keyPrefix: string
    ) {}

    async consume(key: string, cost = 1): Promise<TokenBucketDecision> {
        const storageKey = `${this.keyPrefix}:${this.policyName}:${key}`;
        const ttlSeconds = this.computeTtlSeconds();

        const rawResult = await this.redisClient.evalTokenBucket(
            [storageKey],
            [
                String(Date.now()),
                String(this.policy.refillRatePerSecond),
                String(this.policy.capacity),
                String(cost),
                String(ttlSeconds * 1000),
            ]
        );

        const [allowed, remaining, retryAfterSeconds] = this.parseResult(rawResult);

        return {
            allowed: allowed === 1,
            remaining,
            retryAfterSeconds,
        };
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
