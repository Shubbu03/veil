"use client";

import { useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { SectionHeader } from "@/components/section-header";
import { WalletGate } from "@/components/wallet-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useConfigQuery, useCoordinatorHealthQuery, useCreateVaultMutation, useEmployerVaultsQuery } from "@/hooks/use-dashboard-data";
import { formatAddress, formatNumber } from "@/lib/format";
import { rawAmountToDecimal } from "@/lib/token";
import { KNOWN_DEVNET_MINTS } from "@/lib/constants";

export function VaultsScreen() {
  const { connected } = useWallet();
  const vaults = useEmployerVaultsQuery();
  const config = useConfigQuery();
  const coordinatorHealth = useCoordinatorHealthQuery();
  const createVaultMutation = useCreateVaultMutation();
  const [manualMint, setManualMint] = useState("");
  const [selectedMint, setSelectedMint] = useState("");

  const coordinatorStatus = coordinatorHealth.data
    ? coordinatorHealth.data.status === "healthy"
      ? "online"
      : "offline"
    : coordinatorHealth.isError
      ? "offline"
      : "unknown";

  const allowedMints = config.data?.whitelistEnabled
    ? config.data.allowedMints
    : KNOWN_DEVNET_MINTS.map((mint) => ({ ...mint }));

  const mintToCreate = config.data?.whitelistEnabled ? selectedMint : manualMint || selectedMint;
  const isConfigMissing = connected && config.data === null && !config.isLoading && !config.isError;
  const vaultAlreadyExists = Boolean(mintToCreate && vaults.data?.some((vault) => vault.tokenMint.address === mintToCreate));
  const createVaultDisabled = !mintToCreate || createVaultMutation.isPending || config.isLoading || isConfigMissing || vaultAlreadyExists;

  return (
    <AppShell coordinatorStatus={coordinatorStatus}>
      <div className="space-y-6">
        <SectionHeader
          eyebrow="Vaults"
          title="Vault balances by mint"
          description="Keep funding split by token and reserve only what active schedules need."
        />

        {!connected ? (
          <WalletGate />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_380px]">
            <div>
              {vaults.data?.length ? (
                <div className="grid gap-4">
                  {vaults.data.map((vault) => (
                    <Card key={vault.publicKey}>
                      <CardHeader className="border-b border-border/70">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <CardTitle>{vault.tokenMint.symbol}</CardTitle>
                            <p className="mt-1 text-sm text-muted-foreground">{vault.tokenMint.name}</p>
                          </div>
                          <Badge tone="accent">{formatAddress(vault.publicKey, 6)}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="grid gap-3 pt-5 md:grid-cols-3">
                        <div className="rounded-3xl border border-border/70 bg-muted/45 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Available</p>
                          <p className="mt-2 text-xl font-semibold">
                            {formatNumber(Number(rawAmountToDecimal(vault.availableRaw, vault.tokenMint.decimals)))} {vault.tokenMint.symbol}
                          </p>
                        </div>
                        <div className="rounded-3xl border border-border/70 bg-muted/45 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Reserved</p>
                          <p className="mt-2 text-xl font-semibold">
                            {formatNumber(Number(rawAmountToDecimal(vault.reservedRaw, vault.tokenMint.decimals)))} {vault.tokenMint.symbol}
                          </p>
                        </div>
                        <div className="flex items-center justify-between rounded-3xl border border-border/70 bg-muted/45 p-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Vault ATA</p>
                            <p className="mt-2 font-mono text-xs text-muted-foreground">{formatAddress(vault.vaultAta, 6)}</p>
                          </div>
                          <Button asChild variant="secondary">
                            <Link href={`/vaults/${vault.tokenMint.address}`}>Manage</Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No vaults yet"
                  description="Create your first vault to fund schedules from a specific SPL mint."
                />
              )}
            </div>

            <Card className="h-fit">
              <CardHeader className="border-b border-border/70">
                <CardTitle>Create vault</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="mint-picker">
                    Mint preset
                  </label>
                  <select
                    className="app-select"
                    id="mint-picker"
                    onChange={(event) => {
                      setSelectedMint(event.target.value);
                      if (config.data?.whitelistEnabled) {
                        setManualMint(event.target.value);
                      }
                    }}
                    value={selectedMint}
                  >
                    <option value="">Select a mint</option>
                    {allowedMints.map((mint) => (
                      <option key={mint.address} value={mint.address}>
                        {mint.symbol} · {mint.address.slice(0, 4)}
                      </option>
                    ))}
                  </select>
                </div>

                {!config.data?.whitelistEnabled ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="mint-manual">
                      Manual mint address
                    </label>
                    <Input
                      id="mint-manual"
                      onChange={(event) => setManualMint(event.target.value)}
                      placeholder="Enter any SPL mint on devnet"
                      value={manualMint}
                    />
                  </div>
                ) : null}

                <div className="rounded-3xl border border-border/70 bg-muted/45 p-4 text-sm leading-7 text-muted-foreground">
                  {isConfigMissing
                    ? "Protocol config is missing for the current devnet deployment. Initialize the on-chain config before creating vaults."
                    : vaultAlreadyExists
                      ? "This wallet already has a vault for the selected mint."
                    : config.data?.whitelistEnabled
                      ? "Vault creation is limited to approved protocol mints."
                      : "Any valid devnet SPL mint can be used here."}
                </div>

                {createVaultMutation.isError ? (
                  <p className="text-sm text-destructive">
                    {createVaultMutation.error instanceof Error ? createVaultMutation.error.message : "Failed to create vault."}
                  </p>
                ) : null}

                <Button
                  className="w-full"
                  disabled={createVaultDisabled}
                  onClick={() => {
                    void createVaultMutation.mutateAsync(mintToCreate);
                  }}
                >
                  {config.isLoading ? "Loading config…" : createVaultMutation.isPending ? "Creating vault…" : "Create vault"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
