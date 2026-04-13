"use client";

import Link from "next/link";
import { useDeferredValue } from "react";
import { useQueryState, parseAsString } from "nuqs";
import { useWallet } from "@solana/wallet-adapter-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { SectionHeader } from "@/components/section-header";
import { WalletGate } from "@/components/wallet-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCoordinatorHealthQuery, useEmployerSchedulesQuery } from "@/hooks/use-dashboard-data";
import { formatAddress, formatRelativeTime } from "@/lib/format";
import { rawAmountToDecimal } from "@/lib/token";
import { scheduleStatusTone } from "@/lib/veil";

export function SchedulesScreen() {
  const { connected } = useWallet();
  const schedules = useEmployerSchedulesQuery();
  const coordinatorHealth = useCoordinatorHealthQuery();
  const [search, setSearch] = useQueryState("search", parseAsString.withDefault(""));
  const [statusFilter, setStatusFilter] = useQueryState("status", parseAsString.withDefault("all"));
  const deferredSearch = useDeferredValue(search);

  const coordinatorStatus = coordinatorHealth.data
    ? coordinatorHealth.data.status === "healthy"
      ? "online"
      : "offline"
    : coordinatorHealth.isError
      ? "offline"
      : "unknown";

  const filteredSchedules = (schedules.data ?? []).filter((schedule) => {
    const matchesStatus = statusFilter === "all" || schedule.status.toLowerCase() === statusFilter;
    const matchesSearch =
      deferredSearch.length === 0 ||
      schedule.publicKey.toLowerCase().includes(deferredSearch.toLowerCase()) ||
      schedule.tokenMint?.symbol.toLowerCase().includes(deferredSearch.toLowerCase());

    return matchesStatus && matchesSearch;
  }).sort((left, right) => right.nextExecutionMs - left.nextExecutionMs);

  return (
    <AppShell coordinatorStatus={coordinatorStatus}>
      <div className="space-y-6">
        <SectionHeader
          eyebrow="Schedules"
          title="Schedules"
          description="Review payout schedules directly from on-chain state, grouped with their funding vaults."
          action={
            <Button asChild>
              <Link href="/schedules/new">Create schedule</Link>
            </Button>
          }
        />

        {!connected ? (
          <WalletGate />
        ) : (
          <>
            <Card>
              <CardContent className="grid gap-3 pt-5 md:grid-cols-[minmax(0,1fr)_220px]">
                <Input onChange={(event) => void setSearch(event.target.value)} placeholder="Search by mint or schedule PDA" value={search} />
                <select
                  className="app-select"
                  onChange={(event) => void setStatusFilter(event.target.value)}
                  value={statusFilter}
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </CardContent>
            </Card>

            {filteredSchedules.length ? (
              <div className="grid gap-4">
                {filteredSchedules.map((schedule) => (
                  <Card key={schedule.publicKey}>
                    <CardHeader className="border-b border-border/70">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <CardTitle>{schedule.tokenMint?.symbol ?? "Unknown mint"} schedule</CardTitle>
                          <p className="mt-1 text-sm text-muted-foreground">{formatAddress(schedule.publicKey, 8)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={scheduleStatusTone(schedule.status)}>{schedule.status}</Badge>
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/schedules/${schedule.publicKey}`}>Open</Link>
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-3 pt-5 md:grid-cols-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Per cycle</p>
                        <p className="mt-2 font-semibold">
                          {schedule.tokenMint
                            ? `${rawAmountToDecimal(schedule.perExecutionAmountRaw, schedule.tokenMint.decimals)} ${schedule.tokenMint.symbol}`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Reserved</p>
                        <p className="mt-2 font-semibold">
                          {schedule.tokenMint
                            ? `${rawAmountToDecimal(schedule.reservedAmountRaw, schedule.tokenMint.decimals)} ${schedule.tokenMint.symbol}`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recipients</p>
                        <p className="mt-2 font-semibold">{schedule.totalRecipients}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Next execution</p>
                        <p className="mt-2 font-semibold">{formatRelativeTime(schedule.nextExecutionMs)}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No schedules found"
                description="Create a schedule after funding a vault. Search and filters will show up once you have schedules."
              />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
