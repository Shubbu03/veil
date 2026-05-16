"use client";

import { AnchorProvider, BN } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Buffer } from "buffer";
import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress, getMint } from "@solana/spl-token";
import {
  ScheduleStatus,
  VeilClient,
  buildMerkleTree,
  type Recipient,
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
  intervalSecs: number;
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
type RawScheduleAccount = { vault: PublicKey };

const MIN_SCHEDULE_INTERVAL_SECS = 60 * 60;
const MAX_SCHEDULE_INTERVAL_SECS = 31 * 24 * 60 * 60;
const MAX_SCHEDULE_RECIPIENTS = 1024;
const MAX_U64 = (1n << 64n) - 1n;
const UPDATE_SCHEDULE_DISCRIMINATOR = [121, 160, 17, 111, 16, 230, 228, 70] as const;

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
    intervalSecs: Number(account.intervalSecs.toString()),
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

export async function updateScheduleFromRecipients(
  client: VeilClient,
  input: {
    schedulePda: PublicKey;
    intervalSecs: number;
    reservedAmount: BN;
    recipients: Recipient[];
  },
) {
  const { root } = buildMerkleTree(input.recipients);
  const perExecutionAmount = sumRecipientAmounts(input.recipients);
  validateScheduleUpdate(input, perExecutionAmount, root);
  const schedule = await fetchRawScheduleAccount(client, input.schedulePda);
  const signature = await sendUpdateScheduleInstruction(client, {
    schedulePda: input.schedulePda,
    vaultPda: schedule.vault,
    intervalSecs: input.intervalSecs,
    reservedAmount: input.reservedAmount,
    perExecutionAmount,
    merkleRoot: root,
    totalRecipients: input.recipients.length,
  });

  return {
    signature,
    merkleRoot: Array.from(root),
  };
}

async function sendUpdateScheduleInstruction(
  client: VeilClient,
  input: {
    schedulePda: PublicKey;
    vaultPda: PublicKey;
    intervalSecs: number;
    reservedAmount: BN;
    perExecutionAmount: BN;
    merkleRoot: Buffer;
    totalRecipients: number;
  },
) {
  const [configPda] = PublicKey.findProgramAddressSync([new TextEncoder().encode("veil_config")], client.program.programId);
  const transaction = new Transaction().add(
    new TransactionInstruction({
      programId: client.program.programId,
      keys: [
        { pubkey: client.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: input.vaultPda, isSigner: false, isWritable: true },
        { pubkey: input.schedulePda, isSigner: false, isWritable: true },
      ],
      data: encodeUpdateScheduleInstruction(input),
    }),
  );

  const provider = client.program.provider as AnchorProvider;

  return provider.sendAndConfirm(transaction);
}

function encodeUpdateScheduleInstruction(input: {
  intervalSecs: number;
  reservedAmount: BN;
  perExecutionAmount: BN;
  merkleRoot: Buffer;
  totalRecipients: number;
}) {
  const data = Buffer.alloc(8 + 8 + 8 + 8 + 32 + 2);
  let offset = 0;

  data.set(UPDATE_SCHEDULE_DISCRIMINATOR, offset);
  offset += 8;
  data.set(new BN(input.intervalSecs).toArrayLike(Buffer, "le", 8), offset);
  offset += 8;
  data.set(input.reservedAmount.toArrayLike(Buffer, "le", 8), offset);
  offset += 8;
  data.set(input.perExecutionAmount.toArrayLike(Buffer, "le", 8), offset);
  offset += 8;
  data.set(input.merkleRoot, offset);
  offset += 32;
  data.writeUInt16LE(input.totalRecipients, offset);

  return data;
}

async function fetchRawScheduleAccount(client: VeilClient, schedulePda: PublicKey) {
  try {
    const accounts = client.program.account as {
      scheduleAccount?: { fetch: (address: PublicKey) => Promise<RawScheduleAccount> };
    };
    const schedule = await accounts.scheduleAccount?.fetch(schedulePda);

    if (!schedule) {
      throw new Error("schedule account unavailable");
    }

    return schedule;
  } catch {
    throw new Error("schedule not found");
  }
}

function validateScheduleUpdate(
  input: {
    intervalSecs: number;
    reservedAmount: BN;
    recipients: Recipient[];
  },
  perExecutionAmount: BN,
  merkleRoot: Buffer,
) {
  if (
    !Number.isInteger(input.intervalSecs) ||
    input.intervalSecs < MIN_SCHEDULE_INTERVAL_SECS ||
    input.intervalSecs > MAX_SCHEDULE_INTERVAL_SECS
  ) {
    throw new Error(`intervalSecs must be between ${MIN_SCHEDULE_INTERVAL_SECS} and ${MAX_SCHEDULE_INTERVAL_SECS}`);
  }

  if (input.recipients.length <= 0 || input.recipients.length > MAX_SCHEDULE_RECIPIENTS) {
    throw new Error(`recipients must be between 1 and ${MAX_SCHEDULE_RECIPIENTS}`);
  }

  if (input.reservedAmount.lte(new BN(0))) {
    throw new Error("reservedAmount must be greater than 0");
  }

  assertFitsU64(input.reservedAmount, "reservedAmount");

  if (perExecutionAmount.lte(new BN(0))) {
    throw new Error("perExecutionAmount must be greater than 0");
  }

  assertFitsU64(perExecutionAmount, "perExecutionAmount");

  if (perExecutionAmount.gt(input.reservedAmount)) {
    throw new Error("perExecutionAmount cannot exceed reservedAmount");
  }

  if (merkleRoot.length !== 32) {
    throw new Error("merkleRoot must be 32 bytes");
  }
}

function assertFitsU64(value: BN, name: string) {
  if (BigInt(value.toString()) > MAX_U64) {
    throw new Error(`${name} exceeds u64 max`);
  }
}

function sumRecipientAmounts(recipients: Recipient[]) {
  let total = 0n;

  for (const recipient of recipients) {
    if (recipient.amount <= 0n) {
      throw new Error("recipient amounts must be greater than 0");
    }

    total += recipient.amount;
  }

  return toBn(total);
}
