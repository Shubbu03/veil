import { TokenBucketDecision, TokenBucketPolicy } from "./types";

interface BucketState {
    tokens: number;
    lastRefillAtMs: number;
}

export class InMemoryTokenBucketLimiter {
    private readonly buckets = new Map<string, BucketState>();

    constructor(private readonly policy: TokenBucketPolicy) {}

    consume(key: string, cost = 1): TokenBucketDecision {
        const now = Date.now();
        const existing = this.buckets.get(key);
        const state = this.refillBucket(existing, now);

        if (state.tokens < cost) {
            const missingTokens = cost - state.tokens;
            const retryAfterSeconds = this.policy.refillRatePerSecond > 0
                ? Math.ceil(missingTokens / this.policy.refillRatePerSecond)
                : 60;

            this.buckets.set(key, state);

            return {
                allowed: false,
                remaining: Math.max(0, Math.floor(state.tokens)),
                retryAfterSeconds: Math.max(1, retryAfterSeconds),
            };
        }

        state.tokens -= cost;
        this.buckets.set(key, state);

        return {
            allowed: true,
            remaining: Math.max(0, Math.floor(state.tokens)),
            retryAfterSeconds: 0,
        };
    }

    private refillBucket(existing: BucketState | undefined, now: number): BucketState {
        if (!existing) {
            return {
                tokens: this.policy.capacity,
                lastRefillAtMs: now,
            };
        }

        const elapsedSeconds = Math.max(0, (now - existing.lastRefillAtMs) / 1000);
        const refilledTokens = elapsedSeconds * this.policy.refillRatePerSecond;

        return {
            tokens: Math.min(this.policy.capacity, existing.tokens + refilledTokens),
            lastRefillAtMs: now,
        };
    }
}
