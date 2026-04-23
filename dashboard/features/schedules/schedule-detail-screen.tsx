"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowSquareOut, CopySimple, X } from "phosphor-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AppShell } from "@/components/app-shell";
import { SectionHeader } from "@/components/section-header";
import { WalletGate } from "@/components/wallet-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useCancelScheduleMutation, useCoordinatorExecutionHistoryQuery, useCoordinatorHealthQuery, useCoordinatorScheduleQuery, usePauseScheduleMutation, useScheduleDetailQuery, useRegisterScheduleMutation } from "@/hooks/use-dashboard-data";
import type { CoordinatorExecutionAttempt, CoordinatorExecutionRun, CoordinatorRegistrationPayload } from "@/lib/coordinator";
import { clearPendingRegistration, getPendingRegistration } from "@/lib/pending-registrations";
import { notify, userFacingError } from "@/lib/notify";
import { explorerUrl } from "@/lib/solana";
import { formatAddress, formatDateTime, formatInteger, formatRelativeTime } from "@/lib/format";
import { rawAmountToDecimal } from "@/lib/token";
import { getScheduleNextExecutionLabel, scheduleStatusTone } from "@/lib/veil";

export function ScheduleDetailScreen({ schedulePda }: { schedulePda: string }) {
  const { connected } = useWallet();
  const schedule = useScheduleDetailQuery(schedulePda);
  const registration = useCoordinatorScheduleQuery(schedulePda);
  const executionHistory = useCoordinatorExecutionHistoryQuery(schedulePda, 10);
  const coordinatorHealth = useCoordinatorHealthQuery();
  const pauseMutation = usePauseScheduleMutation(schedulePda);
  const cancelMutation = useCancelScheduleMutation(schedulePda);
  const registerMutation = useRegisterScheduleMutation(schedulePda);
  const [pendingRegistration, setPendingRegistration] = useState<CoordinatorRegistrationPayload | null>(null);
  const [selectedAttemptError, setSelectedAttemptError] = useState<{ title: string; message: string } | null>(null);
  const retryAvailable = Boolean(pendingRegistration);
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
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="border-b border-border/70">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle>On-chain status</CardTitle>
                      <Badge tone={scheduleStatusTone(scheduleData.status)}>{scheduleData.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 pt-5 md:grid-cols-2">
                    {scheduleData.status === "Active" ? (
                      <>
                        <DetailItem label="Next execution" value={formatDateTime(scheduleData.nextExecutionMs)} />
                        <DetailItem label="Relative time" value={getScheduleNextExecutionLabel(scheduleData)} />
                      </>
                    ) : null}
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

              <Card>
                <CardHeader className="border-b border-border/70">
                  <CardTitle>Execution history</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  {executionHistory.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading execution history…</p>
                  ) : executionHistory.isError ? (
                    <p className="text-sm text-muted-foreground">Execution history is unavailable right now.</p>
                  ) : executionHistory.data?.runs.length ? (
                    <div className="space-y-3">
                      {executionHistory.data.runs.map((run) => (
                        <ExecutionRunCard
                          key={run.id}
                          onViewAttemptError={(title, message) => setSelectedAttemptError({ title, message })}
                          run={run}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No execution runs have been recorded for this schedule yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4">
              <Card>
                <CardHeader className="border-b border-border/70">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>Coordinator registration</CardTitle>
                    <Badge tone={registration.data ? "success" : retryAvailable ? "warning" : "muted"}>
                      {registration.data ? "Registered" : retryAvailable ? "Retry available" : "Payload unavailable"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  {registration.data ? (
                    <div className="space-y-3 rounded-3xl border border-border/70 bg-muted/45 p-4 text-sm">
                      <DetailItem label="Registered at" value={formatDateTime(registration.data.createdAt)} />
                      <DetailItem label="Recipients mirrored" value={registration.data.recipientCount.toString()} />
                    </div>
                  ) : retryAvailable ? (
                    <p className="text-sm leading-7 text-muted-foreground">
                      Coordinator registration is still missing, but this browser has the original recipient payload so you can retry it now.
                    </p>
                  ) : (
                    <p className="text-sm leading-7 text-muted-foreground">
                      This schedule is not confirmed in the coordinator store, and this browser no longer has the original recipient payload needed to retry registration.
                    </p>
                  )}

                  {!registration.data ? (
                    <p className="text-xs leading-6 text-muted-foreground">
                      The execution interval does not affect registration timing. Coordinator registration happens immediately after creation, not after the first run.
                    </p>
                  ) : null}

                  {!registration.data && retryAvailable ? (
                    <Button
                      className="w-full"
                      disabled={registerMutation.isPending}
                      onClick={async () => {
                        if (!pendingRegistration) {
                          return;
                        }

                        try {
                          await registerMutation.mutateAsync(pendingRegistration);
                          clearPendingRegistration(schedulePda);
                          setPendingRegistration(null);
                          notify("Coordinator registration completed.", "success");
                        } catch (error) {
                          notify(userFacingError(error, "Could not register this schedule. Try again."), "error");
                        }
                      }}
                      variant="secondary"
                    >
                      {registerMutation.isPending ? "Registering…" : "Retry coordinator registration"}
                    </Button>
                  ) : null}
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
                        onClick={async () => {
                          try {
                            const shouldPause = scheduleData.status !== "Paused";
                            await pauseMutation.mutateAsync(shouldPause);
                            notify(shouldPause ? "Schedule paused." : "Schedule resumed.", "success");
                          } catch (error) {
                            notify(userFacingError(error, "Could not update the schedule. Try again."), "error");
                          }
                        }}
                        variant="secondary"
                      >
                        {scheduleData.status === "Paused" ? "Resume schedule" : "Pause schedule"}
                      </Button>
                      {scheduleData.status === "Paused" ? (
                        registration.data ? (
                          <Button asChild className="w-full" variant="secondary">
                            <Link href={`/schedules/${schedulePda}/edit`}>Edit schedule</Link>
                          </Button>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Editing needs the coordinator recipient payload, which is not available for this schedule.
                          </p>
                        )
                      ) : null}
                      <Button
                        className="w-full"
                        disabled={cancelMutation.isPending}
                        onClick={async () => {
                          try {
                            await cancelMutation.mutateAsync();
                            notify("Schedule cancelled.", "success");
                          } catch (error) {
                            notify(userFacingError(error, "Could not cancel the schedule. Try again."), "error");
                          }
                        }}
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

        {selectedAttemptError ? (
          <ErrorDetailsModal
            error={selectedAttemptError}
            onClose={() => setSelectedAttemptError(null)}
          />
        ) : null}
      </div>
    </AppShell>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}

function AddressRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <code className="font-mono text-xs text-muted-foreground">{formatAddress(value, 10)}</code>
        <a className="text-accent" href={explorerUrl(`address/${value}`)} rel="noreferrer" target="_blank">
          <ArrowSquareOut size={16} />
        </a>
      </div>
    </div>
  );
}

function ExecutionRunCard({ run, onViewAttemptError }: { run: CoordinatorExecutionRun; onViewAttemptError: (title: string, message: string) => void }) {
  return (
    <div className="space-y-4 rounded-3xl border border-border/70 bg-muted/35 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Scheduled for {formatDateTime(run.scheduledFor * 1000)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {run.status === "succeeded" || run.status === "running"
              ? formatRelativeTime(run.scheduledFor * 1000)
              : `Retry window ${formatRelativeTime(run.nextAttemptAt * 1000)}`}
          </p>
        </div>
        <Badge tone={executionRunTone(run.status)}>{run.status}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="Attempts" value={`${formatInteger(run.attemptCount)} / ${formatInteger(run.maxAttempts)}`} />
        <DetailItem label="Claimed" value={formatInteger(run.claimedCount)} />
        <DetailItem label="Duplicate skips" value={formatInteger(run.alreadyPaidCount)} />
        <DetailItem label="Failed claims" value={formatInteger(run.failedClaimCount)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DetailItem label="Started" value={run.startedAt ? formatDateTime(run.startedAt * 1000) : "—"} />
        <DetailItem label="Finished" value={run.finishedAt ? formatDateTime(run.finishedAt * 1000) : "—"} />
      </div>

      {run.delegateSignature || run.commitSignature ? (
        <div className="grid gap-4 md:grid-cols-2">
          {run.delegateSignature ? <SignatureRow label="Delegate transaction" value={run.delegateSignature} /> : null}
          {run.commitSignature ? <SignatureRow label="Commit transaction" value={run.commitSignature} /> : null}
        </div>
      ) : null}

      {run.attempts.length ? (
        <div className="space-y-2 border-t border-border/70 pt-4">
          <p className="text-xs font-medium text-muted-foreground">Attempts</p>
          <div className="space-y-2">
            {run.attempts.map((attempt) => (
              <ExecutionAttemptRow
                key={attempt.id}
                attempt={attempt}
                onViewError={attempt.error ? () => onViewAttemptError(`Attempt ${attempt.attemptNumber} · ${attempt.stage}`, attempt.error ?? "Unknown error") : undefined}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExecutionAttemptRow({
  attempt,
  onViewError,
}: {
  attempt: CoordinatorExecutionAttempt;
  onViewError?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/70 px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">
            Attempt {attempt.attemptNumber} · {attempt.stage}
          </p>
          <Badge tone={attempt.status === "failed" ? "destructive" : "success"}>{attempt.status}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{formatDateTime(attempt.finishedAt * 1000)}</p>
      </div>
      <div className="flex flex-col items-start gap-3 md:items-end">
        {attempt.txSignature ? <SignatureRow label="Transaction" value={attempt.txSignature} /> : null}
        {attempt.status === "failed" && onViewError ? (
          <Button onClick={onViewError} size="sm" type="button" variant="secondary">
            View error
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ErrorDetailsModal({
  error,
  onClose,
}: {
  error: { title: string; message: string };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm">
      <div className="panel w-full max-w-2xl rounded-4xl border border-border/80 bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-lg font-semibold">{error.title}</p>
            <p className="text-sm text-muted-foreground">Coordinator error details for this failed attempt.</p>
          </div>
          <button
            aria-label="Close error details"
            className="rounded-full border border-border/70 p-2 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <Textarea className="min-h-48 resize-none font-mono text-xs leading-6" readOnly value={error.message} />
          <div className="flex justify-end gap-3">
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(error.message);
                  notify("Error copied to clipboard.", "success");
                } catch {
                  notify("Could not copy the error. Try again.", "error");
                }
              }}
              type="button"
              variant="secondary"
            >
              <CopySimple size={16} />
              Copy error
            </Button>
            <Button onClick={onClose} type="button" variant="ghost">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignatureRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <code className="font-mono text-xs text-muted-foreground">{formatAddress(value, 10)}</code>
        <a className="text-accent" href={explorerUrl(`tx/${value}`)} rel="noreferrer" target="_blank">
          <ArrowSquareOut size={16} />
        </a>
      </div>
    </div>
  );
}

function executionRunTone(status: CoordinatorExecutionRun["status"]) {
  switch (status) {
    case "succeeded":
      return "success";
    case "failed":
    case "exhausted":
      return "destructive";
    case "running":
      return "accent";
    case "pending":
    default:
      return "warning";
  }
}
