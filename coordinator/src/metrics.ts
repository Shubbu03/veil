import {
    collectDefaultMetrics,
    Counter,
    Gauge,
    Histogram,
    Registry,
} from "prom-client";

export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry });

export const schedulerPollsTotal = new Counter({
    name: "veil_scheduler_polls_total",
    help: "Total number of scheduler polling cycles",
    registers: [metricsRegistry],
});

export const schedulerPollDurationSeconds = new Histogram({
    name: "veil_scheduler_poll_duration_seconds",
    help: "Duration of scheduler poll cycles",
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
    registers: [metricsRegistry],
});

export const schedulerDueSchedulesTotal = new Counter({
    name: "veil_scheduler_due_schedules_total",
    help: "Total number of due schedules discovered by the scheduler",
    registers: [metricsRegistry],
});

export const executionRunsTotal = new Counter({
    name: "veil_execution_runs_total",
    help: "Total number of execution run completions by status",
    labelNames: ["status"] as const,
    registers: [metricsRegistry],
});

export const executionAttemptsTotal = new Counter({
    name: "veil_execution_attempts_total",
    help: "Total number of execution stage attempts by stage and status",
    labelNames: ["stage", "status"] as const,
    registers: [metricsRegistry],
});

export const executionRunDurationSeconds = new Histogram({
    name: "veil_execution_run_duration_seconds",
    help: "Execution run duration by final status",
    labelNames: ["status"] as const,
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
    registers: [metricsRegistry],
});

export const executionRunsInProgress = new Gauge({
    name: "veil_execution_runs_in_progress",
    help: "Number of execution runs currently in progress",
    registers: [metricsRegistry],
});

export const claimsTotal = new Counter({
    name: "veil_claims_total",
    help: "Claim outcomes processed by the executor",
    labelNames: ["status"] as const,
    registers: [metricsRegistry],
});

export const apiRequestsTotal = new Counter({
    name: "veil_api_requests_total",
    help: "Total HTTP requests handled by the coordinator API",
    labelNames: ["method", "route", "status_code"] as const,
    registers: [metricsRegistry],
});

export const apiRequestDurationSeconds = new Histogram({
    name: "veil_api_request_duration_seconds",
    help: "HTTP request durations for the coordinator API",
    labelNames: ["method", "route"] as const,
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [metricsRegistry],
});

export const apiRateLimitDecisionsTotal = new Counter({
    name: "veil_api_rate_limit_decisions_total",
    help: "Rate limit decisions by policy and outcome",
    labelNames: ["policy", "outcome"] as const,
    registers: [metricsRegistry],
});

export const apiConcurrentRequestsTotal = new Counter({
    name: "veil_api_concurrency_limit_decisions_total",
    help: "Concurrency limit decisions by policy and outcome",
    labelNames: ["policy", "outcome"] as const,
    registers: [metricsRegistry],
});

export const apiRateLimitBackendEventsTotal = new Counter({
    name: "veil_api_rate_limit_backend_events_total",
    help: "Rate limit backend usage, fallback, and error events",
    labelNames: ["policy", "backend", "outcome"] as const,
    registers: [metricsRegistry],
});
