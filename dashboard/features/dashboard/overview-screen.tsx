"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { WalletGate } from "@/components/wallet-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useConfigQuery, useCoordinatorHealthQuery, useEmployerSchedulesQuery, useEmployerVaultsQuery } from "@/hooks/use-dashboard-data";
import { formatInteger } from "@/lib/format";

export function OverviewScreen() {
  const { connected } = useWallet();
  const coordinatorHealth = useCoordinatorHealthQuery();
  const config = useConfigQuery();
  const vaults = useEmployerVaultsQuery();
  const schedules = useEmployerSchedulesQuery();

  const coordinatorStatus = coordinatorHealth.data
    ? coordinatorHealth.data.status === "healthy"
      ? "online"
      : "offline"
    : coordinatorHealth.isError
      ? "offline"
      : "unknown";

  return (
    <AppShell coordinatorStatus={coordinatorStatus}>
      <div className="space-y-6">
        <div className="panel relative overflow-hidden px-6 py-6 md:px-8 md:py-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,190,72,0.16),transparent_34%),radial-gradient(circle_at_right,rgba(70,184,226,0.12),transparent_26%)]" />
          <div className="relative flex flex-col gap-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="max-w-4xl space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">Manage vaults and schedules without the noise.</h1>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                  Keep balances split by mint, compose payout schedules, and inspect protocol state from one place on devnet.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="secondary">
                  <Link href="/vaults">View vaults</Link>
                </Button>
                <Button asChild>
                  <Link href="/schedules/new">Create schedule</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Coordinator"
            value={coordinatorStatus === "online" ? "Online" : coordinatorStatus === "offline" ? "Offline" : "Unknown"}
            caption={
              coordinatorHealth.data ? `${formatInteger(coordinatorHealth.data.schedulesRegistered)} registered schedules` : "Execution layer status"
            }
          />
          <StatCard
            label="Vaults"
            value={connected ? formatInteger(vaults.data?.length ?? 0) : "0"}
            caption="Token-specific funding accounts"
          />
          <StatCard
            label="Schedules"
            value={connected ? formatInteger(schedules.data?.length ?? 0) : "0"}
            caption="Active, paused, and cancelled"
          />
          <StatCard
            label="Whitelist"
            value={config.data?.whitelistEnabled ? "Enabled" : "Open"}
            caption={config.data ? `${formatInteger(config.data.allowedMints.length)} approved mints` : "Protocol configuration"}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/70">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Protocol
                </p>
                <CardTitle>Current configuration</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 pt-5 md:grid-cols-2">
              <div className="rounded-3xl border border-border/70 bg-muted/45 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pause state</p>
                <p className="mt-2 text-lg font-semibold">{config.data?.paused ? "Paused" : "Operational"}</p>
              </div>
              <div className="rounded-3xl border border-border/70 bg-muted/45 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Max recipients</p>
                <p className="mt-2 text-lg font-semibold">{config.data ? formatInteger(config.data.maxRecipients) : "—"}</p>
              </div>
              <div className="rounded-3xl border border-border/70 bg-muted/45 p-4 md:col-span-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Allowed mints</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {config.data?.allowedMints.length ? (
                    config.data.allowedMints.map((mint) => (
                      <Badge key={mint.address} tone="accent">
                        {mint.symbol}
                      </Badge>
                    ))
                  ) : (
                    <Badge>Any SPL mint</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {connected ? (
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border/70">
                <CardTitle>Shortcuts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-5">
                <Button asChild className="w-full justify-between">
                  <Link href="/vaults">Open vaults</Link>
                </Button>
                <Button asChild className="w-full justify-between" variant="secondary">
                  <Link href="/schedules/new">Create a schedule</Link>
                </Button>
                <Button asChild className="w-full justify-between" variant="ghost">
                  <Link href="/schedules">Review schedules</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <WalletGate />
          )}
        </div>
      </div>
    </AppShell>
  );
}
