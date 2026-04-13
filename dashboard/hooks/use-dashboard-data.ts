"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { getCoordinatorHealth, getCoordinatorSchedule, registerScheduleWithCoordinator, type CoordinatorRegistrationPayload } from "@/lib/coordinator";
import { dashboardEnv } from "@/lib/env";
import { useVeilClient } from "@/hooks/use-veil-client";
import {
  fetchConfig,
  fetchEmployerSchedules,
  fetchEmployerVaults,
  fetchScheduleByPda,
  fetchVaultByMint,
  fetchWalletTokenBalance,
  isWalletReady,
  toBn,
} from "@/lib/veil";
import { parsePublicKey } from "@/lib/solana";

const queryKeys = {
  config: ["veil", "config"] as const,
  coordinatorHealth: ["coordinator", "health"] as const,
  coordinatorSchedule: (schedulePda: string) => ["coordinator", "schedule", schedulePda] as const,
  vaults: (employer: string | undefined) => ["veil", "vaults", employer] as const,
  vault: (employer: string | undefined, mint: string) => ["veil", "vault", employer, mint] as const,
  walletTokenBalance: (owner: string | undefined, mint: string) => ["veil", "wallet-token-balance", owner, mint] as const,
  schedules: (employer: string | undefined) => ["veil", "schedules", employer] as const,
  schedule: (schedulePda: string) => ["veil", "schedule", schedulePda] as const,
} as const;

export function useConfigQuery() {
  const client = useVeilClient();

  return useQuery({
    queryKey: queryKeys.config,
    queryFn: () => {
      if (!client) {
        return null;
      }

      return fetchConfig(client);
    },
    enabled: Boolean(client),
  });
}

export function useCoordinatorHealthQuery() {
  return useQuery({
    queryKey: queryKeys.coordinatorHealth,
    queryFn: getCoordinatorHealth,
    enabled: Boolean(dashboardEnv.coordinatorUrl),
    staleTime: 10_000,
    refetchInterval: 20_000,
  });
}

export function useCoordinatorScheduleQuery(schedulePda: string) {
  return useQuery({
    queryKey: queryKeys.coordinatorSchedule(schedulePda),
    queryFn: () => getCoordinatorSchedule(schedulePda),
    enabled: Boolean(dashboardEnv.coordinatorUrl && schedulePda),
  });
}

export function useEmployerVaultsQuery() {
  const client = useVeilClient();
  const wallet = useAnchorWallet();

  return useQuery({
    queryKey: queryKeys.vaults(wallet?.publicKey?.toBase58()),
    queryFn: () => {
      if (!client || !isWalletReady(wallet)) {
        return [];
      }

      return fetchEmployerVaults(client, wallet.publicKey);
    },
    enabled: Boolean(client && isWalletReady(wallet)),
  });
}

export function useVaultDetailQuery(mintAddress: string) {
  const client = useVeilClient();
  const wallet = useAnchorWallet();

  return useQuery({
    queryKey: queryKeys.vault(wallet?.publicKey?.toBase58(), mintAddress),
    queryFn: () => {
      if (!client || !isWalletReady(wallet)) {
        return null;
      }

      return fetchVaultByMint(client, wallet.publicKey, parsePublicKey(mintAddress));
    },
    enabled: Boolean(client && isWalletReady(wallet) && mintAddress),
  });
}

export function useWalletTokenBalanceQuery(mintAddress: string) {
  const client = useVeilClient();
  const wallet = useAnchorWallet();

  return useQuery({
    queryKey: queryKeys.walletTokenBalance(wallet?.publicKey?.toBase58(), mintAddress),
    queryFn: () => {
      if (!client || !isWalletReady(wallet)) {
        return null;
      }

      return fetchWalletTokenBalance(client, wallet.publicKey, parsePublicKey(mintAddress));
    },
    enabled: Boolean(client && isWalletReady(wallet) && mintAddress),
  });
}

export function useEmployerSchedulesQuery() {
  const client = useVeilClient();
  const wallet = useAnchorWallet();

  return useQuery({
    queryKey: queryKeys.schedules(wallet?.publicKey?.toBase58()),
    queryFn: () => {
      if (!client || !isWalletReady(wallet)) {
        return [];
      }

      return fetchEmployerSchedules(client, wallet.publicKey);
    },
    enabled: Boolean(client && isWalletReady(wallet)),
  });
}

export function useScheduleDetailQuery(schedulePda: string) {
  const client = useVeilClient();

  return useQuery({
    queryKey: queryKeys.schedule(schedulePda),
    queryFn: () => {
      if (!client) {
        return null;
      }

      return fetchScheduleByPda(client, parsePublicKey(schedulePda));
    },
    enabled: Boolean(client && schedulePda),
  });
}

export function useCreateVaultMutation() {
  const client = useVeilClient();
  const wallet = useAnchorWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mintAddress: string) => {
      if (!client || !isWalletReady(wallet)) {
        throw new Error("Connect a wallet first.");
      }

      try {
        return await client.initVault(parsePublicKey(mintAddress));
      } catch (error) {
        if (error instanceof Error && error.message.includes("AccountNotInitialized")) {
          throw new Error("Protocol config is not initialized for the current devnet program deployment. Initialize config before creating vaults.");
        }

        if (error instanceof Error && (error.message.includes("already in use") || error.message.includes("custom program error: 0x0"))) {
          throw new Error("A vault for this mint already exists for the connected wallet.");
        }

        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.vaults(wallet?.publicKey?.toBase58()),
      });
    },
  });
}

export function useDepositMutation(mintAddress: string) {
  const client = useVeilClient();
  const wallet = useAnchorWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (amountRaw: bigint) => {
      if (!client || !isWalletReady(wallet)) {
        throw new Error("Connect a wallet first.");
      }

      const walletTokenBalance = await fetchWalletTokenBalance(client, wallet.publicKey, parsePublicKey(mintAddress));

      if (amountRaw <= BigInt(0)) {
        throw new Error("Enter a deposit amount greater than zero.");
      }

      if (walletTokenBalance.balanceRaw < amountRaw) {
        throw new Error("Wallet token balance is too low for this deposit.");
      }

      try {
        return await client.deposit(toBn(amountRaw), parsePublicKey(mintAddress));
      } catch (error) {
        if (error instanceof Error && error.message.toLowerCase().includes("insufficient funds")) {
          throw new Error("Wallet token balance is too low for this deposit.");
        }

        throw error;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.vault(wallet?.publicKey?.toBase58(), mintAddress) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.vaults(wallet?.publicKey?.toBase58()) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.walletTokenBalance(wallet?.publicKey?.toBase58(), mintAddress) }),
      ]);
    },
  });
}

export function useWithdrawMutation(mintAddress: string) {
  const client = useVeilClient();
  const wallet = useAnchorWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (amountRaw: bigint) => {
      if (!client || !isWalletReady(wallet)) {
        throw new Error("Connect a wallet first.");
      }

      return client.withdraw(toBn(amountRaw), parsePublicKey(mintAddress));
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.vault(wallet?.publicKey?.toBase58(), mintAddress) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.vaults(wallet?.publicKey?.toBase58()) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.walletTokenBalance(wallet?.publicKey?.toBase58(), mintAddress) }),
      ]);
    },
  });
}

export function usePauseScheduleMutation(schedulePda: string) {
  const client = useVeilClient();
  const wallet = useAnchorWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pause: boolean) => {
      if (!client || !isWalletReady(wallet)) {
        throw new Error("Connect a wallet first.");
      }

      return client.pauseSchedule(parsePublicKey(schedulePda), pause);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.schedule(schedulePda) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.schedules(wallet?.publicKey?.toBase58()) }),
      ]);
    },
  });
}

export function useCancelScheduleMutation(schedulePda: string) {
  const client = useVeilClient();
  const wallet = useAnchorWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!client || !isWalletReady(wallet)) {
        throw new Error("Connect a wallet first.");
      }

      return client.cancelSchedule(parsePublicKey(schedulePda));
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.schedule(schedulePda) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.schedules(wallet?.publicKey?.toBase58()) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.vaults(wallet?.publicKey?.toBase58()) }),
      ]);
    },
  });
}

export function useRegisterScheduleMutation(schedulePda: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CoordinatorRegistrationPayload) => registerScheduleWithCoordinator(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.coordinatorSchedule(schedulePda) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.coordinatorHealth }),
      ]);
    },
  });
}
