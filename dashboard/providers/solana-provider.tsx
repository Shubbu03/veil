"use client";

import { PropsWithChildren } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { dashboardEnv } from "@/lib/env";

const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

export function SolanaProvider({ children }: PropsWithChildren) {
  return (
    <ConnectionProvider endpoint={dashboardEnv.rpcUrl}>
      <WalletProvider autoConnect wallets={wallets}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
