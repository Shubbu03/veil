"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ThemeProvider } from "@/providers/theme-provider";
import { SolanaWalletProvider } from "@/providers/solana-provider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <NuqsAdapter>
        <SolanaWalletProvider>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </SolanaWalletProvider>
      </NuqsAdapter>
    </ThemeProvider>
  );
}
