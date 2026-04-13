"use client";

import type { CoordinatorRegistrationPayload } from "@/lib/coordinator";

const STORAGE_KEY = "veil-pending-registrations";

function readStore() {
  if (typeof window === "undefined") {
    return {} as Record<string, CoordinatorRegistrationPayload>;
  }

  const localValue = window.localStorage.getItem(STORAGE_KEY);
  if (localValue) {
    return JSON.parse(localValue) as Record<string, CoordinatorRegistrationPayload>;
  }

  const sessionValue = window.sessionStorage.getItem(STORAGE_KEY);
  if (!sessionValue) {
    return {} as Record<string, CoordinatorRegistrationPayload>;
  }

  const parsed = JSON.parse(sessionValue) as Record<string, CoordinatorRegistrationPayload>;
  window.localStorage.setItem(STORAGE_KEY, sessionValue);
  window.sessionStorage.removeItem(STORAGE_KEY);
  return parsed;
}

function writeStore(value: Record<string, CoordinatorRegistrationPayload>) {
  if (typeof window === "undefined") {
    return;
  }

  const encoded = JSON.stringify(value);
  window.localStorage.setItem(STORAGE_KEY, encoded);
  window.sessionStorage.setItem(STORAGE_KEY, encoded);
}

export function storePendingRegistration(payload: CoordinatorRegistrationPayload) {
  const current = readStore();
  current[payload.schedulePda] = payload;
  writeStore(current);
}

export function getPendingRegistration(schedulePda: string) {
  return readStore()[schedulePda] ?? null;
}

export function clearPendingRegistration(schedulePda: string) {
  const current = readStore();
  delete current[schedulePda];
  writeStore(current);
}
