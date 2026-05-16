import type { Request } from "express";

export function getRequestIp(req: Request): string {
    const forwardedFor = req.headers["x-forwarded-for"];
    if (typeof forwardedFor === "string" && forwardedFor.trim()) {
        return forwardedFor.split(",")[0].trim();
    }

    return req.ip || req.socket.remoteAddress || "unknown";
}

export function buildIpKey(route: string, req: Request): string {
    return `${route}:ip:${getRequestIp(req)}`;
}

export function buildWalletKey(route: string, wallet: string): string {
    return `${route}:wallet:${wallet}`;
}
