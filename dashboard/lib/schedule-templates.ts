"use client";

export type ScheduleTemplateIntervalUnit = "hours" | "days";

export interface ScheduleTemplateRecipient {
  address: string;
  amount: string;
}

export interface ScheduleTemplate {
  id: string;
  version: 1;
  wallet: string;
  name: string;
  tokenMint: string;
  intervalValue: number;
  intervalUnit: ScheduleTemplateIntervalUnit;
  reservedAmount: string;
  recipients: ScheduleTemplateRecipient[];
  createdAt: number;
  updatedAt: number;
}

export interface SaveScheduleTemplateInput {
  wallet: string;
  name: string;
  tokenMint: string;
  intervalValue: number;
  intervalUnit: ScheduleTemplateIntervalUnit;
  reservedAmount: string;
  recipients: ScheduleTemplateRecipient[];
}

const STORAGE_KEY = "veil-schedule-templates";
const TEMPLATE_VERSION = 1;
const MAX_TEMPLATES_PER_WALLET = 50;
const MAX_TEMPLATE_RECIPIENTS = 1000;

export function listScheduleTemplates(wallet: string) {
  const normalizedWallet = wallet.trim();
  return readTemplates()
    .filter((template) => template.wallet === normalizedWallet)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function saveScheduleTemplate(input: SaveScheduleTemplateInput) {
  const now = Date.now();
  const currentTemplates = readTemplates();
  const normalizedName = normalizeName(input.name);
  const normalizedWallet = input.wallet.trim();
  const existingTemplate = currentTemplates.find(
    (template) =>
      template.wallet === normalizedWallet &&
      template.name.toLowerCase() === normalizedName.toLowerCase(),
  );

  const savedTemplate: ScheduleTemplate = {
    id: existingTemplate?.id ?? createTemplateId(),
    version: TEMPLATE_VERSION,
    wallet: normalizedWallet,
    name: normalizedName,
    tokenMint: input.tokenMint.trim(),
    intervalValue: input.intervalValue,
    intervalUnit: input.intervalUnit,
    reservedAmount: input.reservedAmount.trim(),
    recipients: input.recipients.map((recipient) => ({
      address: recipient.address.trim(),
      amount: recipient.amount.trim(),
    })),
    createdAt: existingTemplate?.createdAt ?? now,
    updatedAt: now,
  };

  if (!isValidTemplate(savedTemplate)) {
    throw new Error("Template data is incomplete.");
  }

  const withoutExisting = currentTemplates.filter((template) => template.id !== savedTemplate.id);
  const nextWalletTemplates = [savedTemplate, ...withoutExisting.filter((template) => template.wallet === normalizedWallet)]
    .slice(0, MAX_TEMPLATES_PER_WALLET);
  const otherWalletTemplates = withoutExisting.filter((template) => template.wallet !== normalizedWallet);
  writeTemplates([...nextWalletTemplates, ...otherWalletTemplates]);

  return savedTemplate;
}

export function deleteScheduleTemplate(wallet: string, templateId: string) {
  const normalizedWallet = wallet.trim();
  writeTemplates(
    readTemplates().filter(
      (template) => !(template.wallet === normalizedWallet && template.id === templateId),
    ),
  );
}

function readTemplates() {
  if (typeof window === "undefined") {
    return [] as ScheduleTemplate[];
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(isValidTemplate);
  } catch {
    return [];
  }
}

function writeTemplates(templates: ScheduleTemplate[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates.filter(isValidTemplate)));
}

function isValidTemplate(value: unknown): value is ScheduleTemplate {
  if (!isRecord(value)) {
    return false;
  }

  const recipients = value.recipients;
  return (
    value.version === TEMPLATE_VERSION &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.wallet === "string" &&
    value.wallet.length > 0 &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    typeof value.tokenMint === "string" &&
    value.tokenMint.length > 0 &&
    typeof value.intervalValue === "number" &&
    Number.isInteger(value.intervalValue) &&
    value.intervalValue > 0 &&
    (value.intervalUnit === "hours" || value.intervalUnit === "days") &&
    typeof value.reservedAmount === "string" &&
    value.reservedAmount.trim().length > 0 &&
    Array.isArray(recipients) &&
    recipients.length > 0 &&
    recipients.length <= MAX_TEMPLATE_RECIPIENTS &&
    recipients.every(isValidRecipient) &&
    typeof value.createdAt === "number" &&
    typeof value.updatedAt === "number"
  );
}

function isValidRecipient(value: unknown): value is ScheduleTemplateRecipient {
  return (
    isRecord(value) &&
    typeof value.address === "string" &&
    value.address.trim().length >= 32 &&
    typeof value.amount === "string" &&
    value.amount.trim().length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 80);
}

function createTemplateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
