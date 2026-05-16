export interface TokenBucketPolicy {
    capacity: number;
    refillRatePerSecond: number;
}

export type RateLimitPolicyName = "register" | "schedule-read" | "execution-history-read";

export interface TokenBucketDecision {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
}

export interface ConcurrencyDecision {
    allowed: boolean;
    active: number;
    limit: number;
}

export interface RateLimitContext {
    key: string;
    policyName: string;
}
