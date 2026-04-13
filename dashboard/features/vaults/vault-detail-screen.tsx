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
import { useCoordinatorHealthQuery, useDepositMutation, useVaultDetailQuery, useWalletTokenBalanceQuery, useWithdrawMutation } from "@/hooks/use-dashboard-data";
import { explorerUrl } from "@/lib/solana";
import { decimalToRawAmount, rawAmountToDecimal } from "@/lib/token";
import { formatAddress } from "@/lib/format";

export function VaultDetailScreen({ mint }: { mint: string }) {
  const { connected } = useWallet();
  const vault = useVaultDetailQuery(mint);
  const coordinatorHealth = useCoordinatorHealthQuery();
  const depositMutation = useDepositMutation(mint);
  const withdrawMutation = useWithdrawMutation(mint);
  const walletTokenBalance = useWalletTokenBalanceQuery(mint);
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
  const depositAmountRaw = vaultData ? decimalToRawAmount(depositAmount, vaultData.tokenMint.decimals) : BigInt(0);
  const withdrawAmountRaw = vaultData ? decimalToRawAmount(withdrawAmount, vaultData.tokenMint.decimals) : BigInt(0);
  const walletBalanceRaw = walletTokenBalance.data?.balanceRaw ?? BigInt(0);
  const depositAmountInvalid = depositAmountRaw <= BigInt(0) || depositAmountRaw > walletBalanceRaw;
  const withdrawAmountInvalid = withdrawAmountRaw <= BigInt(0);

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
          <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.12fr)]">
            <div className="grid gap-4">
              <Card>
                <CardHeader className="border-b border-border/70">
                  <CardTitle>Balances</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 pt-5 sm:grid-cols-2">
                  <div className="rounded-3xl border border-border/70 bg-muted/45 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Available</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {rawAmountToDecimal(vaultData.availableRaw, vaultData.tokenMint.decimals)} {vaultData.tokenMint.symbol}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-muted/45 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Reserved</p>
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
                <CardContent className="space-y-3 pt-5 text-sm">
                  <div className="rounded-3xl border border-border/70 bg-muted/35 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Vault PDA</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <code className="font-mono text-xs text-muted-foreground">{formatAddress(vaultData.publicKey, 10)}</code>
                      <a className="shrink-0 text-accent" href={explorerUrl(`address/${vaultData.publicKey}`)} rel="noreferrer" target="_blank">
                        <ArrowSquareOut size={16} />
                      </a>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-muted/35 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Vault ATA</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <code className="font-mono text-xs text-muted-foreground">{formatAddress(vaultData.vaultAta, 10)}</code>
                      <a className="shrink-0 text-accent" href={explorerUrl(`address/${vaultData.vaultAta}`)} rel="noreferrer" target="_blank">
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
                  <div className="rounded-3xl border border-border/70 bg-muted/45 p-4 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">Wallet balance</p>
                    <p className="mt-2 font-semibold">
                      {walletTokenBalance.isLoading
                        ? "Loading…"
                        : `${rawAmountToDecimal(walletBalanceRaw, vaultData.tokenMint.decimals)} ${vaultData.tokenMint.symbol}`}
                    </p>
                  </div>
                  <Input
                    onChange={(event) => setDepositAmount(event.target.value)}
                    placeholder={`Amount in ${vaultData.tokenMint.symbol}`}
                    value={depositAmount}
                  />
                  {depositAmount && depositAmountInvalid ? (
                    <p className="text-sm text-destructive">Wallet token balance is too low for this deposit.</p>
                  ) : null}
                  {depositMutation.isError ? (
                    <p className="text-sm text-destructive">
                      {depositMutation.error instanceof Error ? depositMutation.error.message : "Deposit failed."}
                    </p>
                  ) : null}
                  <Button
                    className="w-full"
                    disabled={!depositAmount || depositMutation.isPending || walletTokenBalance.isLoading || depositAmountInvalid}
                    onClick={async () => {
                      const amountRaw = decimalToRawAmount(depositAmount, vaultData.tokenMint.decimals);
                      await depositMutation.mutateAsync(amountRaw);
                      setDepositAmount("");
                    }}
                  >
                    {depositMutation.isPending ? "Depositing…" : walletTokenBalance.isLoading ? "Checking balance…" : "Deposit tokens"}
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
                  {withdrawAmount && withdrawAmountInvalid ? (
                    <p className="text-sm text-destructive">Enter a withdraw amount greater than zero.</p>
                  ) : null}
                  {withdrawMutation.isError ? (
                    <p className="text-sm text-destructive">
                      {withdrawMutation.error instanceof Error ? withdrawMutation.error.message : "Withdraw failed."}
                    </p>
                  ) : null}
                  <Button
                    className="w-full"
                    disabled={!withdrawAmount || withdrawMutation.isPending || withdrawAmountInvalid}
                    onClick={async () => {
                      const amountRaw = decimalToRawAmount(withdrawAmount, vaultData.tokenMint.decimals);
                      await withdrawMutation.mutateAsync(amountRaw);
                      setWithdrawAmount("");
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
