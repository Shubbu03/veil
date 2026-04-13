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
