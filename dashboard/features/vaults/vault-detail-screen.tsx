"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowSquareOut } from "phosphor-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AppShell } from "@/components/app-shell";
import { SectionHeader } from "@/components/section-header";
import { WalletGate } from "@/components/wallet-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCoordinatorHealthQuery, useDepositMutation, useVaultDetailQuery, useWithdrawMutation } from "@/hooks/use-dashboard-data";
import { explorerUrl } from "@/lib/solana";
import { decimalToRawAmount, rawAmountToDecimal } from "@/lib/token";
import { formatAddress } from "@/lib/format";

export function VaultDetailScreen({ mint }: { mint: string }) {
  const { connected } = useWallet();
  const vault = useVaultDetailQuery(mint);
  const coordinatorHealth = useCoordinatorHealthQuery();
  const depositMutation = useDepositMutation(mint);
  const withdrawMutation = useWithdrawMutation(mint);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const coordinatorStatus = coordinatorHealth.data
    ? coordinatorHealth.data.status === "healthy"
      ? "online"
      : "offline"
    : coordinatorHealth.isError
      ? "offline"
      : "unknown";
  const vaultData = vault.data;

  if (!connected) {
    return (
      <AppShell coordinatorStatus={coordinatorStatus}>
        <WalletGate />
      </AppShell>
    );
  }

  return (
    <AppShell coordinatorStatus={coordinatorStatus}>
      <div className="space-y-6">
        <SectionHeader
          eyebrow="Vault Detail"
          title={vaultData ? `${vaultData.tokenMint.symbol} vault` : "Vault detail"}
          description="Move free balance in or out of this vault and use it to fund schedules."
          action={
            <Button asChild variant="ghost">
              <Link href="/vaults">
                <ArrowLeft size={16} weight="bold" />
                Back to vaults
              </Link>
            </Button>
          }
        />

        {vaultData ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="border-b border-border/70">
                  <CardTitle>Balances</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  <div className="rounded-3xl border border-border/70 bg-muted/45 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Available</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {rawAmountToDecimal(vaultData.availableRaw, vaultData.tokenMint.decimals)} {vaultData.tokenMint.symbol}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-muted/45 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Reserved</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {rawAmountToDecimal(vaultData.reservedRaw, vaultData.tokenMint.decimals)} {vaultData.tokenMint.symbol}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-border/70">
                  <CardTitle>Addresses</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-5 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Vault PDA</p>
                    <div className="mt-2 flex items-center gap-3">
                      <code className="font-mono text-xs text-muted-foreground">{formatAddress(vaultData.publicKey, 10)}</code>
                      <a className="text-accent" href={explorerUrl(`address/${vaultData.publicKey}`)} rel="noreferrer" target="_blank">
                        <ArrowSquareOut size={16} />
                      </a>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Vault ATA</p>
                    <div className="mt-2 flex items-center gap-3">
                      <code className="font-mono text-xs text-muted-foreground">{formatAddress(vaultData.vaultAta, 10)}</code>
                      <a className="text-accent" href={explorerUrl(`address/${vaultData.vaultAta}`)} rel="noreferrer" target="_blank">
                        <ArrowSquareOut size={16} />
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4">
              <Card>
                <CardHeader className="border-b border-border/70">
                  <CardTitle>Deposit</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  <Input
                    onChange={(event) => setDepositAmount(event.target.value)}
                    placeholder={`Amount in ${vaultData.tokenMint.symbol}`}
                    value={depositAmount}
                  />
                  {depositMutation.isError ? (
                    <p className="text-sm text-destructive">
                      {depositMutation.error instanceof Error ? depositMutation.error.message : "Deposit failed."}
                    </p>
                  ) : null}
                  <Button
                    className="w-full"
                    disabled={!depositAmount || depositMutation.isPending}
                    onClick={() => {
                      const amountRaw = decimalToRawAmount(depositAmount, vaultData.tokenMint.decimals);
                      void depositMutation.mutateAsync(amountRaw);
                    }}
                  >
                    {depositMutation.isPending ? "Depositing…" : "Deposit tokens"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-border/70">
                  <CardTitle>Withdraw</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  <Input
                    onChange={(event) => setWithdrawAmount(event.target.value)}
                    placeholder={`Amount in ${vaultData.tokenMint.symbol}`}
                    value={withdrawAmount}
                  />
                  {withdrawMutation.isError ? (
                    <p className="text-sm text-destructive">
                      {withdrawMutation.error instanceof Error ? withdrawMutation.error.message : "Withdraw failed."}
                    </p>
                  ) : null}
                  <Button
                    className="w-full"
                    disabled={!withdrawAmount || withdrawMutation.isPending}
                    onClick={() => {
                      const amountRaw = decimalToRawAmount(withdrawAmount, vaultData.tokenMint.decimals);
                      void withdrawMutation.mutateAsync(amountRaw);
                    }}
                    variant="secondary"
                  >
                    {withdrawMutation.isPending ? "Withdrawing…" : "Withdraw available balance"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="pt-5 text-sm text-muted-foreground">Vault not found for this mint.</CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
