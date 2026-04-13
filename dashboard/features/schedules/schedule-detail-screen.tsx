"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowSquareOut } from "phosphor-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AppShell } from "@/components/app-shell";
import { SectionHeader } from "@/components/section-header";
import { WalletGate } from "@/components/wallet-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCancelScheduleMutation, useCoordinatorHealthQuery, useCoordinatorScheduleQuery, usePauseScheduleMutation, useScheduleDetailQuery, useRegisterScheduleMutation } from "@/hooks/use-dashboard-data";
import type { CoordinatorRegistrationPayload } from "@/lib/coordinator";
import { clearPendingRegistration, getPendingRegistration } from "@/lib/pending-registrations";
import { explorerUrl } from "@/lib/solana";
import { formatAddress, formatDateTime, formatRelativeTime } from "@/lib/format";
import { rawAmountToDecimal } from "@/lib/token";
import { scheduleStatusTone } from "@/lib/veil";

export function ScheduleDetailScreen({ schedulePda }: { schedulePda: string }) {
  const { connected } = useWallet();
  const schedule = useScheduleDetailQuery(schedulePda);
  const registration = useCoordinatorScheduleQuery(schedulePda);
  const coordinatorHealth = useCoordinatorHealthQuery();
  const pauseMutation = usePauseScheduleMutation(schedulePda);
  const cancelMutation = useCancelScheduleMutation(schedulePda);
  const registerMutation = useRegisterScheduleMutation(schedulePda);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [pendingRegistration, setPendingRegistration] = useState<CoordinatorRegistrationPayload | null>(null);
  const coordinatorStatus = coordinatorHealth.data
    ? coordinatorHealth.data.status === "healthy"
      ? "online"
      : "offline"
    : coordinatorHealth.isError
      ? "offline"
      : "unknown";
  const scheduleData = schedule.data;

  useEffect(() => {
    setPendingRegistration(getPendingRegistration(schedulePda));
  }, [schedulePda]);

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
          eyebrow="Schedule Detail"
          title={scheduleData?.tokenMint ? `${scheduleData.tokenMint.symbol} schedule` : "Schedule detail"}
          description="On-chain state is shown here. Coordinator registration appears separately because recipient data is kept off-chain."
          action={
            <Button asChild variant="ghost">
              <Link href="/schedules">
                <ArrowLeft size={16} weight="bold" />
                Back to schedules
              </Link>
            </Button>
          }
        />

        {scheduleData ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="border-b border-border/70">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>On-chain status</CardTitle>
                    <Badge tone={scheduleStatusTone(scheduleData.status)}>{scheduleData.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 pt-5 md:grid-cols-2">
                  <DetailItem label="Next execution" value={formatDateTime(scheduleData.nextExecutionMs)} />
                  <DetailItem label="Relative time" value={formatRelativeTime(scheduleData.nextExecutionMs)} />
                  <DetailItem
                    label="Per cycle"
                    value={
                      scheduleData.tokenMint
                        ? `${rawAmountToDecimal(scheduleData.perExecutionAmountRaw, scheduleData.tokenMint.decimals)} ${scheduleData.tokenMint.symbol}`
                        : "—"
                    }
                  />
                  <DetailItem
                    label="Reserved"
                    value={
                      scheduleData.tokenMint
                        ? `${rawAmountToDecimal(scheduleData.reservedAmountRaw, scheduleData.tokenMint.decimals)} ${scheduleData.tokenMint.symbol}`
                        : "—"
                    }
                  />
                  <DetailItem label="Recipients" value={scheduleData.totalRecipients.toString()} />
                  <DetailItem label="Vault" value={formatAddress(scheduleData.vault, 8)} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-border/70">
                  <CardTitle>Addresses</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-5 text-sm">
                  <AddressRow label="Schedule PDA" value={scheduleData.publicKey} />
                  <AddressRow label="Vault PDA" value={scheduleData.vault} />
                  <AddressRow label="Employer" value={scheduleData.employer} />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4">
              <Card>
                <CardHeader className="border-b border-border/70">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>Coordinator registration</CardTitle>
                    <Badge tone={registration.data ? "success" : pendingRegistration ? "warning" : "muted"}>
                      {registration.data ? "Registered" : pendingRegistration ? "Pending retry" : "Not registered"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  {registration.data ? (
                    <div className="space-y-3 rounded-3xl border border-border/70 bg-muted/45 p-4 text-sm">
                      <DetailItem label="Registered at" value={formatDateTime(registration.data.createdAt)} />
                      <DetailItem label="Recipients mirrored" value={registration.data.recipientCount.toString()} />
                    </div>
                  ) : (
                    <p className="text-sm leading-7 text-muted-foreground">
                      This schedule is not confirmed in the coordinator store. Registration is only possible if the browser still has the original recipient payload.
                    </p>
                  )}

                  {registerMutation.isError ? (
                    <p className="text-sm text-destructive">
                      {registerMutation.error instanceof Error ? registerMutation.error.message : "Registration failed."}
                    </p>
                  ) : null}

                  {localMessage ? <p className="text-sm text-success">{localMessage}</p> : null}

                  <Button
                    className="w-full"
                    disabled={!pendingRegistration || registerMutation.isPending}
                    onClick={() => {
                      if (!pendingRegistration) {
                        return;
                      }

                      void registerMutation.mutateAsync(pendingRegistration).then(() => {
                        clearPendingRegistration(schedulePda);
                        setPendingRegistration(null);
                        setLocalMessage("Coordinator registration completed.");
                      });
                    }}
                    variant="secondary"
                  >
                    {registerMutation.isPending ? "Registering…" : "Retry coordinator registration"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-border/70">
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 pt-5">
                  {scheduleData.status !== "Cancelled" ? (
                    <>
                      <Button
                        className="w-full"
                        disabled={pauseMutation.isPending}
                        onClick={() => void pauseMutation.mutateAsync(scheduleData.status !== "Paused")}
                        variant="secondary"
                      >
                        {scheduleData.status === "Paused" ? "Resume schedule" : "Pause schedule"}
                      </Button>
                      <Button
                        className="w-full"
                        disabled={cancelMutation.isPending}
                        onClick={() => void cancelMutation.mutateAsync()}
                        variant="destructive"
                      >
                        Cancel schedule
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Cancelled schedules are terminal and cannot be resumed.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="pt-5 text-sm text-muted-foreground">Schedule not found.</CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}

function AddressRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <code className="font-mono text-xs text-muted-foreground">{formatAddress(value, 10)}</code>
        <a className="text-accent" href={explorerUrl(`address/${value}`)} rel="noreferrer" target="_blank">
          <ArrowSquareOut size={16} />
        </a>
      </div>
    </div>
  );
}
