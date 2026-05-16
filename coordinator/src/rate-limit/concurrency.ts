import { ConcurrencyDecision } from "./types";

export class InMemoryConcurrencyLimiter {
    private readonly activeCounts = new Map<string, number>();

    constructor(private readonly limit: number) {}

    acquire(key: string): ConcurrencyDecision {
        const active = this.activeCounts.get(key) ?? 0;
        if (active >= this.limit) {
            return {
                allowed: false,
                active,
                limit: this.limit,
            };
        }

        this.activeCounts.set(key, active + 1);
        return {
            allowed: true,
            active: active + 1,
            limit: this.limit,
        };
    }

    release(key: string) {
        const active = this.activeCounts.get(key) ?? 0;
        if (active <= 1) {
            this.activeCounts.delete(key);
            return;
        }

        this.activeCounts.set(key, active - 1);
    }
}
