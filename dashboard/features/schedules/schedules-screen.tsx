"use client";

import Link from "next/link";
import { useDeferredValue, useEffect } from "react";
import { useQueryState, parseAsInteger, parseAsString } from "nuqs";
import { Rows, SquaresFour } from "phosphor-react";
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
import { paginateItems } from "@/lib/pagination";
import { rawAmountToDecimal } from "@/lib/token";
import { scheduleStatusTone } from "@/lib/veil";

export function SchedulesScreen() {
  const LIST_PAGE_SIZE = 5;
  const GRID_PAGE_SIZE = 6;
  const { connected } = useWallet();
  const schedules = useEmployerSchedulesQuery();
  const coordinatorHealth = useCoordinatorHealthQuery();
  const [search, setSearch] = useQueryState("search", parseAsString.withDefault(""));
  const [statusFilter, setStatusFilter] = useQueryState("status", parseAsString.withDefault("all"));
  const [viewMode, setViewMode] = useQueryState("view", parseAsString.withDefault("list"));
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
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
  const currentView = viewMode === "grid" ? "grid" : "list";
  const pageSize = currentView === "list" ? LIST_PAGE_SIZE : GRID_PAGE_SIZE;
  const pagination = paginateItems(filteredSchedules, page, pageSize);
  const { currentPage, totalPages, pageItems, pageNumbers, hasPreviousPage, hasNextPage } = pagination;

  useEffect(() => {
    if (page !== 1) {
      void setPage(1);
    }
  }, [deferredSearch, page, setPage, statusFilter, viewMode]);

  useEffect(() => {
    if (page !== currentPage) {
      void setPage(currentPage);
    }
  }, [currentPage, page, setPage]);

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
              <CardContent className="grid gap-3 pt-5 md:grid-cols-[minmax(0,1fr)_240px_140px]">
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
                <div className="flex items-center gap-2 rounded-full border border-border bg-card p-1">
                  <button
                    aria-label="List view"
                    className={`flex min-h-10 flex-1 items-center justify-center rounded-full transition-colors ${
                      currentView === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    }`}
                    onClick={() => void setViewMode("list")}
                    type="button"
                  >
                    <Rows size={18} weight={currentView === "list" ? "fill" : "regular"} />
                  </button>
                  <button
                    aria-label="Grid view"
                    className={`flex min-h-10 flex-1 items-center justify-center rounded-full transition-colors ${
                      currentView === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    }`}
                    onClick={() => void setViewMode("grid")}
                    type="button"
                  >
                    <SquaresFour size={18} weight={currentView === "grid" ? "fill" : "regular"} />
                  </button>
                </div>
              </CardContent>
            </Card>

            {filteredSchedules.length ? (
              <>
                <div className={currentView === "list" ? "grid gap-4" : "grid gap-4 lg:grid-cols-2"}>
                  {pageItems.map((schedule) =>
                    currentView === "list" ? (
                      <ScheduleListCard key={schedule.publicKey} schedule={schedule} />
                    ) : (
                      <ScheduleGridCard key={schedule.publicKey} schedule={schedule} />
                    ),
                  )}
                </div>

                {totalPages > 1 ? (
                  <div className="flex flex-col gap-3 pt-2 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button disabled={!hasPreviousPage} onClick={() => void setPage(currentPage - 1)} size="sm" type="button" variant="secondary">
                        Previous
                      </Button>
                      {pageNumbers.map((pageNumber) => (
                        <Button
                          key={pageNumber}
                          onClick={() => void setPage(pageNumber)}
                          size="sm"
                          type="button"
                          variant={pageNumber === currentPage ? "primary" : "ghost"}
                        >
                          {pageNumber}
                        </Button>
                      ))}
                      <Button disabled={!hasNextPage} onClick={() => void setPage(currentPage + 1)} size="sm" type="button" variant="secondary">
                        Next
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
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

function ScheduleListCard({ schedule }: { schedule: NonNullable<ReturnType<typeof useEmployerSchedulesQuery>["data"]>[number] }) {
  return (
    <Card>
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
        <Metric label="Per cycle" value={schedule.tokenMint ? `${rawAmountToDecimal(schedule.perExecutionAmountRaw, schedule.tokenMint.decimals)} ${schedule.tokenMint.symbol}` : "—"} />
        <Metric label="Reserved" value={schedule.tokenMint ? `${rawAmountToDecimal(schedule.reservedAmountRaw, schedule.tokenMint.decimals)} ${schedule.tokenMint.symbol}` : "—"} />
        <Metric label="Recipients" value={schedule.totalRecipients.toString()} />
        <Metric label="Next execution" value={schedule.status === "Cancelled" ? "—" : formatRelativeTime(schedule.nextExecutionMs)} />
      </CardContent>
    </Card>
  );
}

function ScheduleGridCard({ schedule }: { schedule: NonNullable<ReturnType<typeof useEmployerSchedulesQuery>["data"]>[number] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/70">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{schedule.tokenMint?.symbol ?? "Unknown mint"} schedule</CardTitle>
            <Badge tone={scheduleStatusTone(schedule.status)}>{schedule.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{formatAddress(schedule.publicKey, 8)}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="Per cycle" value={schedule.tokenMint ? `${rawAmountToDecimal(schedule.perExecutionAmountRaw, schedule.tokenMint.decimals)} ${schedule.tokenMint.symbol}` : "—"} />
          <Metric label="Reserved" value={schedule.tokenMint ? `${rawAmountToDecimal(schedule.reservedAmountRaw, schedule.tokenMint.decimals)} ${schedule.tokenMint.symbol}` : "—"} />
          <Metric label="Recipients" value={schedule.totalRecipients.toString()} />
          <Metric label="Next execution" value={schedule.status === "Cancelled" ? "—" : formatRelativeTime(schedule.nextExecutionMs)} />
        </div>
        <Button asChild className="w-full" variant="secondary">
          <Link href={`/schedules/${schedule.publicKey}`}>Open schedule</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}
