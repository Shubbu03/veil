import type { NextFunction, Request, Response } from "express";
import { createLogger } from "../logger";
import {
    apiConcurrentRequestsTotal,
    apiRateLimitBackendEventsTotal,
    apiRateLimitDecisionsTotal,
} from "../metrics";
import { InMemoryConcurrencyLimiter } from "./concurrency";
import { buildIpKey } from "./keys";
import { RateLimitRedisClient } from "./redis-client";
import { RedisTokenBucketLimiter } from "./redis-token-bucket";
import { InMemoryTokenBucketLimiter } from "./token-bucket";
import { RateLimitPolicyName, TokenBucketPolicy } from "./types";

const logger = createLogger("rate-limit");

export interface RateLimitServiceConfig {
    enabled: boolean;
    dryRun: boolean;
    redisUrl?: string;
    redisKeyPrefix: string;
    registration: TokenBucketPolicy;
    scheduleReads: TokenBucketPolicy;
    executionHistoryReads: TokenBucketPolicy;
    registrationConcurrency: number;
}

export class RateLimitService {
    private readonly registerLimiter: InMemoryTokenBucketLimiter;
    private readonly scheduleReadLimiter: InMemoryTokenBucketLimiter;
    private readonly executionHistoryReadLimiter: InMemoryTokenBucketLimiter;
    private readonly registrationConcurrencyLimiter: InMemoryConcurrencyLimiter;
    private readonly redisClient: RateLimitRedisClient | null;
    private readonly redisLimiters: Partial<Record<RateLimitPolicyName, RedisTokenBucketLimiter>>;

    constructor(private readonly config: RateLimitServiceConfig) {
        this.registerLimiter = new InMemoryTokenBucketLimiter(config.registration);
        this.scheduleReadLimiter = new InMemoryTokenBucketLimiter(config.scheduleReads);
        this.executionHistoryReadLimiter = new InMemoryTokenBucketLimiter(config.executionHistoryReads);
        this.registrationConcurrencyLimiter = new InMemoryConcurrencyLimiter(config.registrationConcurrency);
        this.redisClient = config.redisUrl ? new RateLimitRedisClient(config.redisUrl) : null;
        this.redisLimiters = this.redisClient
            ? {
                register: new RedisTokenBucketLimiter(
                    this.redisClient,
                    "register",
                    config.registration,
                    config.redisKeyPrefix
                ),
                "schedule-read": new RedisTokenBucketLimiter(
                    this.redisClient,
                    "schedule-read",
                    config.scheduleReads,
                    config.redisKeyPrefix
                ),
                "execution-history-read": new RedisTokenBucketLimiter(
                    this.redisClient,
                    "execution-history-read",
                    config.executionHistoryReads,
                    config.redisKeyPrefix
                ),
            }
            : {};
    }

    rateLimit(options: {
        policyName: RateLimitPolicyName;
        resolveKey?: (req: Request) => string;
    }) {
        return (req: Request, res: Response, next: NextFunction) => {
            void this.handleRateLimit(options.policyName, options.resolveKey, req, res, next);
        };
    }

    registrationConcurrency(req: Request, res: Response, next: NextFunction) {
        if (!this.config.enabled) {
            return next();
        }

        const key = buildIpKey("register-concurrency", req);
        const decision = this.registrationConcurrencyLimiter.acquire(key);

        apiConcurrentRequestsTotal.inc({
            policy: "register",
            outcome: decision.allowed ? "allowed" : "limited",
        });

        if (!decision.allowed && !this.config.dryRun) {
            logger.warn(
                {
                    method: req.method,
                    path: req.originalUrl,
                    key,
                    active: decision.active,
                    limit: decision.limit,
                },
                "Request concurrency limited"
            );

            return res.status(429).json({
                error: "Too many requests. Try again shortly.",
            });
        }

        if (!decision.allowed) {
            logger.warn(
                {
                    method: req.method,
                    path: req.originalUrl,
                    key,
                    active: decision.active,
                    limit: decision.limit,
                    dryRun: true,
                },
                "Concurrency limit would have rejected request"
            );
        }

        let released = false;
        const release = () => {
            if (released) {
                return;
            }
            released = true;
            this.registrationConcurrencyLimiter.release(key);
        };

        res.on("finish", release);
        res.on("close", release);
        next();
    }

    async shutdown() {
        await this.redisClient?.disconnect();
    }

    private async handleRateLimit(
        policyName: RateLimitPolicyName,
        resolveKey: ((req: Request) => string) | undefined,
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        if (!this.config.enabled) {
            return next();
        }

        const key = resolveKey?.(req) ?? buildIpKey(policyName, req);
        const decision = await this.consumeWithBackendFallback(policyName, key, req);

        if (decision.allowed === null) {
            return next();
        }

        apiRateLimitDecisionsTotal.inc({
            policy: policyName,
            outcome: decision.allowed ? "allowed" : "limited",
        });

        res.setHeader("X-RateLimit-Remaining", String(decision.remaining));
        if (!decision.allowed) {
            res.setHeader("Retry-After", String(decision.retryAfterSeconds));
        }

        if (decision.allowed || this.config.dryRun) {
            if (!decision.allowed) {
                logger.warn(
                    {
                        method: req.method,
                        path: req.originalUrl,
                        key,
                        policy: policyName,
                        retryAfterSeconds: decision.retryAfterSeconds,
                        backend: decision.backend,
                        dryRun: true,
                    },
                    "Rate limit would have rejected request"
                );
            }
            return next();
        }

        logger.warn(
            {
                method: req.method,
                path: req.originalUrl,
                key,
                policy: policyName,
                retryAfterSeconds: decision.retryAfterSeconds,
                backend: decision.backend,
            },
            "Request rate limited"
        );

        return res.status(429).json({
            error: "Too many requests. Try again shortly.",
        });
    }

    private async consumeWithBackendFallback(policyName: RateLimitPolicyName, key: string, req: Request) {
        const redisLimiter = this.redisLimiters[policyName];

        if (redisLimiter) {
            try {
                const decision = await redisLimiter.consume(key);
                apiRateLimitBackendEventsTotal.inc({
                    policy: policyName,
                    backend: "redis",
                    outcome: decision.allowed ? "allowed" : "limited",
                });

                return {
                    ...decision,
                    backend: "redis" as const,
                };
            } catch (error) {
                apiRateLimitBackendEventsTotal.inc({
                    policy: policyName,
                    backend: "redis",
                    outcome: "error",
                });

                logger.error(
                    {
                        err: error,
                        policy: policyName,
                        path: req.originalUrl,
                    },
                    "Redis rate limit backend failed"
                );

                if (policyName !== "register") {
                    apiRateLimitBackendEventsTotal.inc({
                        policy: policyName,
                        backend: "fail-open",
                        outcome: "allowed",
                    });

                    return {
                        allowed: null,
                        remaining: -1,
                        retryAfterSeconds: 0,
                        backend: "fail-open" as const,
                    };
                }
            }
        }

        const fallbackDecision = this.getLimiter(policyName).consume(key);
        apiRateLimitBackendEventsTotal.inc({
            policy: policyName,
            backend: redisLimiter ? "memory-fallback" : "memory",
            outcome: fallbackDecision.allowed ? "allowed" : "limited",
        });

        return {
            ...fallbackDecision,
            backend: redisLimiter ? "memory-fallback" as const : "memory" as const,
        };
    }

    private getLimiter(policyName: RateLimitPolicyName) {
        switch (policyName) {
            case "register":
                return this.registerLimiter;
            case "schedule-read":
                return this.scheduleReadLimiter;
            case "execution-history-read":
                return this.executionHistoryReadLimiter;
        }
    }
}
