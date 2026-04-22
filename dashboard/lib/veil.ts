"use client";

import { BN } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress, getMint } from "@solana/spl-token";
import {
  ScheduleStatus,
  VeilClient,
  type ScheduleAccount,
  type VaultAccount,
  type VeilConfig,
  getSchedulePda,
  getVaultPda,
} from "@/lib/sdk";
import { KNOWN_DEVNET_MINTS, SCHEDULE_EMPLOYER_OFFSET, VAULT_EMPLOYER_OFFSET } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";
import { bnToBigInt } from "@/lib/token";

export interface MintInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface UiVault {
  publicKey: string;
  employer: string;
  vaultAta: string;
  tokenMint: MintInfo;
  availableRaw: bigint;
  reservedRaw: bigint;
}

export interface UiSchedule {
  publicKey: string;
  employer: string;
  vault: string;
  tokenMint: MintInfo | null;
  status: ScheduleStatus;
  nextExecutionMs: number;
  reservedAmountRaw: bigint;
  perExecutionAmountRaw: bigint;
  totalRecipients: number;
}

export interface UiConfig {
  paused: boolean;
  whitelistEnabled: boolean;
  maxRecipients: number;
  allowedMints: MintInfo[];
}

export interface UiWalletTokenBalance {
  ata: string;
  balanceRaw: bigint;
}

type RawScheduleStatus = ScheduleStatus | { active?: object; paused?: object; cancelled?: object };

export function createVeilClient(connection: Connection, wallet: AnchorWallet) {
  return new VeilClient({
    connection,
    wallet: wallet as ConstructorParameters<typeof VeilClient>[0]["wallet"],
  });
}

export async function fetchMintInfo(connection: Connection, mint: PublicKey): Promise<MintInfo> {
  const known = KNOWN_DEVNET_MINTS.find((item) => item.address === mint.toBase58());
  if (known) {
    return known;
  }

  const account = await getMint(connection, mint);

  return {
    address: mint.toBase58(),
    symbol: mint.toBase58().slice(0, 4),
    name: `Token ${mint.toBase58().slice(0, 4)}`,
    decimals: account.decimals,
  };
}

export async function fetchConfig(client: VeilClient) {
  const config = await client.getConfig();
  if (!config) {
    return null;
  }

  return toUiConfig(client.connection, config);
}

async function toUiConfig(connection: Connection, config: VeilConfig): Promise<UiConfig> {
  const allowedMints = await Promise.all(config.allowedMints.map((mint) => fetchMintInfo(connection, mint)));

  return {
    paused: config.paused,
    whitelistEnabled: config.whitelistEnabled,
    maxRecipients: config.maxRecipients,
    allowedMints,
  };
}

export async function fetchEmployerVaults(client: VeilClient, employer: PublicKey) {
  const accounts = client.program.account as Record<string, { all: (filters: unknown[]) => Promise<Array<{ publicKey: PublicKey; account: VaultAccount }>> }>;
  const vaults = await accounts.vaultAccount.all([
    {
      memcmp: {
        offset: VAULT_EMPLOYER_OFFSET,
        bytes: employer.toBase58(),
      },
    },
  ]);

  return Promise.all(vaults.map(async ({ publicKey, account }) => toUiVault(client.connection, publicKey, account)));
}

async function toUiVault(connection: Connection, publicKey: PublicKey, account: VaultAccount): Promise<UiVault> {
  return {
    publicKey: publicKey.toBase58(),
    employer: account.employer.toBase58(),
    vaultAta: account.vaultAta.toBase58(),
    tokenMint: await fetchMintInfo(connection, account.tokenMint),
    availableRaw: bnToBigInt(account.available),
    reservedRaw: bnToBigInt(account.reserved),
  };
}

export async function fetchVaultByMint(client: VeilClient, employer: PublicKey, mint: PublicKey) {
  const vault = await client.getVault(mint, employer);
  if (!vault) {
    return null;
  }

  const [vaultPda] = getVaultPda(employer, mint);
  return toUiVault(client.connection, vaultPda, vault);
}

export async function fetchWalletTokenBalance(client: VeilClient, owner: PublicKey, mint: PublicKey): Promise<UiWalletTokenBalance> {
  const ata = await getAssociatedTokenAddress(mint, owner);

  try {
    const account = await getAccount(client.connection, ata);
    return {
      ata: ata.toBase58(),
      balanceRaw: BigInt(account.amount.toString()),
    };
  } catch {
    return {
      ata: ata.toBase58(),
      balanceRaw: BigInt(0),
    };
  }
}

export async function fetchEmployerSchedules(client: VeilClient, employer: PublicKey) {
  const accounts = client.program.account as Record<string, { all: (filters: unknown[]) => Promise<Array<{ publicKey: PublicKey; account: ScheduleAccount }>>; fetch: (publicKey: PublicKey) => Promise<unknown> }>;
  const schedules = await accounts.scheduleAccount.all([
    {
      memcmp: {
        offset: SCHEDULE_EMPLOYER_OFFSET,
        bytes: employer.toBase58(),
      },
    },
  ]);

  const vaultAccounts = await fetchEmployerVaults(client, employer);
  const vaultMap = new Map(vaultAccounts.map((vault) => [vault.publicKey, vault]));

  return schedules.map(({ publicKey, account }) => toUiSchedule(publicKey, account, vaultMap.get(account.vault.toBase58())?.tokenMint ?? null));
}

export async function fetchScheduleByPda(client: VeilClient, schedulePda: PublicKey) {
  const schedule = await client.getSchedule(schedulePda);
  if (!schedule) {
    return null;
  }

  const accounts = client.program.account as Record<string, { fetch: (publicKey: PublicKey) => Promise<VaultAccount> }>;
  const vaultAccount = await accounts.vaultAccount.fetch(schedule.vault);
  const mintInfo = await fetchMintInfo(client.connection, vaultAccount.tokenMint);

  return toUiSchedule(schedulePda, schedule, mintInfo);
}

function toUiSchedule(publicKey: PublicKey, account: ScheduleAccount, mintInfo: MintInfo | null): UiSchedule {
  return {
    publicKey: publicKey.toBase58(),
    employer: account.employer.toBase58(),
    vault: account.vault.toBase58(),
    tokenMint: mintInfo,
    status: parseScheduleStatus(account.status as RawScheduleStatus),
    nextExecutionMs: Number(account.nextExecution.toString()) * 1000,
    reservedAmountRaw: bnToBigInt(account.reservedAmount),
    perExecutionAmountRaw: bnToBigInt(account.perExecutionAmount),
    totalRecipients: account.totalRecipients,
  };
}

function parseScheduleStatus(status: RawScheduleStatus) {
  if (status === ScheduleStatus.Active || (typeof status === "object" && "active" in status)) {
    return ScheduleStatus.Active;
  }

  if (status === ScheduleStatus.Paused || (typeof status === "object" && "paused" in status)) {
    return ScheduleStatus.Paused;
  }

  return ScheduleStatus.Cancelled;
}

export function deriveSchedulePdaFromMint(employer: PublicKey, mint: PublicKey, scheduleId: number[]) {
  const [vaultPda] = getVaultPda(employer, mint);
  const [schedulePda] = getSchedulePda(vaultPda, scheduleId);
  return {
    schedulePda,
    vaultPda,
  };
}

export function scheduleStatusTone(status: ScheduleStatus) {
  switch (status) {
    case ScheduleStatus.Active:
      return "success";
    case ScheduleStatus.Paused:
      return "warning";
    default:
      return "muted";
  }
}

export function sortSchedulesForDisplay(schedules: UiSchedule[]) {
  return [...schedules].sort((left, right) => right.nextExecutionMs - left.nextExecutionMs);
}

export function getScheduleNextExecutionLabel(schedule: Pick<UiSchedule, "status" | "nextExecutionMs">) {
  if (schedule.status === ScheduleStatus.Cancelled) {
    return "—";
  }

  if (schedule.status === ScheduleStatus.Paused) {
    return "Paused";
  }

  if (schedule.nextExecutionMs <= Date.now()) {
    return "Due now";
  }

  return formatRelativeTime(schedule.nextExecutionMs);
}

export function isWalletReady(wallet: AnchorWallet | undefined): wallet is AnchorWallet {
  return Boolean(wallet?.publicKey);
}

export function toBn(value: bigint) {
  return new BN(value.toString());
}
