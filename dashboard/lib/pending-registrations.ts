"use client";

import type { CoordinatorRegistrationPayload } from "@/lib/coordinator";

const STORAGE_KEY = "veil-pending-registrations";

function readStore() {
  if (typeof window === "undefined") {
    return {} as Record<string, CoordinatorRegistrationPayload>;
  }

  const value = window.sessionStorage.getItem(STORAGE_KEY);
  return value ? (JSON.parse(value) as Record<string, CoordinatorRegistrationPayload>) : {};
}

function writeStore(value: Record<string, CoordinatorRegistrationPayload>) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
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
