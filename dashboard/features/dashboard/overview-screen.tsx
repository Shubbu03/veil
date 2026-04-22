"use client";

import Link from "next/link";
import { ArrowRight } from "phosphor-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { WalletGate } from "@/components/wallet-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmployerSchedulesQuery, useEmployerVaultsQuery } from "@/hooks/use-dashboard-data";
import { formatInteger } from "@/lib/format";
import { rawAmountToDecimal } from "@/lib/token";
import { getScheduleNextExecutionLabel, scheduleStatusTone, sortSchedulesForDisplay } from "@/lib/veil";

export function OverviewScreen() {
  const { connected } = useWallet();
  const vaults = useEmployerVaultsQuery();
  const schedules = useEmployerSchedulesQuery();

  const sortedSchedules = sortSchedulesForDisplay(schedules.data ?? []);
  const previewSchedules = sortedSchedules.slice(0, 2);
  const activeSchedules = (schedules.data ?? []).filter((schedule) => schedule.status === "Active").length;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="panel relative overflow-hidden px-6 py-6 md:px-8 md:py-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,190,72,0.16),transparent_34%),radial-gradient(circle_at_right,rgba(70,184,226,0.12),transparent_26%)]" />
          <div className="relative flex flex-col gap-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="max-w-4xl space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">Manage payouts from one place.</h1>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                  Check your vaults, create schedules, and keep payout flows moving without digging through protocol details.
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

        {!connected ? (
          <WalletGate />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <SummaryCard
                label="Vaults"
                value={formatInteger(vaults.data?.length ?? 0)}
                caption="Funding accounts ready for payouts"
              />
              <SummaryCard
                label="Schedules"
                value={formatInteger(schedules.data?.length ?? 0)}
                caption="Total payout schedules linked to this wallet"
              />
              <SummaryCard
                label="Active now"
                value={formatInteger(activeSchedules)}
                caption="Schedules currently ready to keep running"
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border/70">
                  <div className="flex w-full min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <CardTitle>Your schedules</CardTitle>
                      <p className="text-sm text-muted-foreground">The next schedules coming up for this wallet.</p>
                    </div>
                    <Button asChild className="shrink-0 self-end md:self-auto" size="sm" variant="ghost">
                      <Link href="/schedules">
                        View all
                        <ArrowRight size={16} weight="bold" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-5">
                  {previewSchedules.length ? (
                    <div className="grid gap-3">
                      {previewSchedules.map((schedule) => (
                        <div
                          key={schedule.publicKey}
                          className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-muted/30 p-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold">{schedule.tokenMint?.symbol ?? "Unknown"} schedule</p>
                              <Badge tone={scheduleStatusTone(schedule.status)}>{schedule.status}</Badge>
                            </div>
                            {schedule.status === "Active" ? (
                              <p className="text-sm text-muted-foreground">Next run {getScheduleNextExecutionLabel(schedule)}</p>
                            ) : schedule.status === "Paused" ? (
                              <p className="text-sm text-muted-foreground">Schedule is paused</p>
                            ) : null}
                            <p className="text-sm text-muted-foreground">
                              {schedule.tokenMint
                                ? `${rawAmountToDecimal(schedule.perExecutionAmountRaw, schedule.tokenMint.decimals)} ${schedule.tokenMint.symbol} per execution`
                                : "Mint unavailable"}
                            </p>
                          </div>
                          <Button asChild variant="secondary">
                            <Link href={`/schedules/${schedule.publicKey}`}>Open schedule</Link>
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No schedules yet"
                      description="Create your first schedule after funding a vault."
                    />
                  )}
                </CardContent>
              </Card>

              <Card className="h-fit overflow-hidden">
                <CardHeader className="border-b border-border/70">
                  <div className="space-y-1">
                    <CardTitle>Quick actions</CardTitle>
                    <p className="text-sm text-muted-foreground">Use the common actions you are most likely to need next.</p>
                  </div>
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
                  <div className="rounded-3xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                    {vaults.data?.length
                      ? "You already have a funded path into payouts. The next useful step is usually creating or reviewing schedules."
                      : "Start by creating a vault, then deposit funds before creating your first schedule."}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function SummaryCard({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-2 p-5">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-4xl font-semibold tracking-tight">{value}</p>
        <p className="text-sm leading-6 text-muted-foreground">{caption}</p>
      </CardContent>
    </Card>
  );
}
