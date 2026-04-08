import pino from "pino";

export const logger = pino({
    name: "veil-coordinator",
    level: process.env.LOG_LEVEL || "info",
    base: {
        service: "veil-coordinator",
        environment: process.env.NODE_ENV || "development",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});

export function createLogger(component: string) {
    return logger.child({ component });
}
