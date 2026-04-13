"use client";

import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { createVeilClient, isWalletReady } from "@/lib/veil";

export function useVeilClient() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  if (!isWalletReady(wallet)) {
    return null;
  }

  return createVeilClient(connection, wallet);
}
