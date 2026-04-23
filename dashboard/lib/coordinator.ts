import xior from "xior";
import { dashboardEnv } from "@/lib/env";

export interface CoordinatorHealth {
  status: string;
  database: string;
  timestamp: number;
  schedulesRegistered: number;
}

export interface CoordinatorRegistrationStatus {
  schedulePda: string;
  scheduleId: number[];
  vaultEmployer: string;
  recipientCount: number;
  merkleRoot: number[];
  createdAt: number;
}

export interface CoordinatorSchedulePayload {
  schedulePda: string;
  scheduleId: number[];
  vaultEmployer: string;
  tokenMint: string;
  recipients: Array<{ address: string; amount: string }>;
  merkleRoot: number[];
  createdAt: number;
}

export interface CoordinatorExecutionAttempt {
  id: number;
  runId: number;
  attemptNumber: number;
  stage: "delegate" | "claim" | "commit";
  status: "succeeded" | "failed";
  txSignature: string | null;
  details: Record<string, unknown> | null;
  error?: string;
  startedAt: number;
  finishedAt: number;
}

export interface CoordinatorExecutionRun {
  id: number;
  schedulePda: string;
  scheduledFor: number;
  status: "pending" | "running" | "succeeded" | "failed" | "exhausted";
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  claimedCount: number;
  alreadyPaidCount: number;
  failedClaimCount: number;
  delegateSignature: string | null;
  commitSignature: string | null;
  lastError?: string;
  attempts: CoordinatorExecutionAttempt[];
}

export interface CoordinatorExecutionHistory {
  schedulePda: string;
  runs: CoordinatorExecutionRun[];
}

export interface CoordinatorRegistrationPayload {
  schedulePda: string;
  scheduleId: number[];
  vaultEmployer: string;
  tokenMint: string;
  recipients: Array<{ address: string; amount: string }>;
}

const coordinatorApi = dashboardEnv.coordinatorUrl
  ? xior.create({
      baseURL: `${dashboardEnv.coordinatorUrl.replace(/\/$/, "")}/api`,
      timeout: 10_000,
    })
  : null;

export async function getCoordinatorHealth() {
  if (!coordinatorApi) {
    return null;
  }

  const response = await coordinatorApi.get<CoordinatorHealth>("/health");
  return response.data;
}

export async function getCoordinatorSchedule(schedulePda: string) {
  if (!coordinatorApi) {
    return null;
  }

  try {
    const response = await coordinatorApi.get<CoordinatorRegistrationStatus>(`/schedules/${schedulePda}`);
    return response.data;
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

export async function getCoordinatorSchedulePayload(schedulePda: string) {
  if (!coordinatorApi) {
    return null;
  }

  try {
    const response = await coordinatorApi.get<CoordinatorSchedulePayload>(`/schedules/${schedulePda}/payload`);
    return response.data;
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

export async function getCoordinatorExecutionHistory(schedulePda: string, limit = 10) {
  if (!coordinatorApi) {
    return null;
  }

  const response = await coordinatorApi.get<CoordinatorExecutionHistory>(`/schedules/${schedulePda}/executions`, {
    params: { limit },
  });
  return response.data;
}

export async function registerScheduleWithCoordinator(payload: CoordinatorRegistrationPayload) {
  if (!coordinatorApi) {
    throw new Error("Coordinator URL is not configured.");
  }

  const response = await coordinatorApi.post("/schedules", payload);
  return response.data;
}

function isNotFoundError(error: unknown): error is { response?: { status?: number } } {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return false;
  }

  return (error as { response?: { status?: number } }).response?.status === 404;
}
