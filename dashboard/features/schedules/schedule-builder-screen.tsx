"use client";

import { startTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { BN } from "@coral-xyz/anchor";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { SectionHeader } from "@/components/section-header";
import { WalletGate } from "@/components/wallet-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCoordinatorHealthQuery, useEmployerVaultsQuery, useRegisterScheduleMutation } from "@/hooks/use-dashboard-data";
import { storePendingRegistration } from "@/lib/pending-registrations";
import { decimalToRawAmount, rawAmountToDecimal } from "@/lib/token";
import { deriveSchedulePdaFromMint } from "@/lib/veil";
import { useVeilClient } from "@/hooks/use-veil-client";

const recipientSchema = z.object({
  address: z.string().min(32, "Recipient address is required"),
  amount: z.string().min(1, "Amount is required"),
});

const formSchema = z.object({
  vaultMint: z.string().min(1, "Select a funded vault"),
  intervalSecs: z.coerce.number().int().min(3600).max(31 * 24 * 60 * 60),
  reservedAmount: z.string().min(1, "Reserved amount is required"),
  autoRegister: z.boolean(),
  recipients: z.array(recipientSchema).min(1, "At least one recipient is required"),
});

type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

export function ScheduleBuilderScreen() {
  const router = useRouter();
  const wallet = useAnchorWallet();
  const client = useVeilClient();
  const vaults = useEmployerVaultsQuery();
  const coordinatorHealth = useCoordinatorHealthQuery();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const registerMutation = useRegisterScheduleMutation("pending");

  const coordinatorStatus = coordinatorHealth.data
    ? coordinatorHealth.data.status === "healthy"
      ? "online"
      : "offline"
    : coordinatorHealth.isError
      ? "offline"
      : "unknown";

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vaultMint: "",
      intervalSecs: 86400,
      reservedAmount: "",
      autoRegister: true,
      recipients: [{ address: "", amount: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "recipients",
  });

  const selectedVault = vaults.data?.find((vault) => vault.tokenMint.address === form.watch("vaultMint")) ?? null;
  const recipientTotalRaw =
    selectedVault?.tokenMint.decimals !== undefined
      ? form
          .watch("recipients")
          .reduce(
            (total, recipient) => total + decimalToRawAmount(recipient.amount || "0", selectedVault.tokenMint.decimals),
            BigInt(0),
          )
      : BigInt(0);

  async function onSubmit(values: FormValues) {
    if (!client || !wallet || !selectedVault) {
      setSubmitError("Connect a wallet and select a vault before creating a schedule.");
      return;
    }

    try {
      setSubmitError(null);
      const decimals = selectedVault.tokenMint.decimals;
      const reservedAmountRaw = decimalToRawAmount(values.reservedAmount, decimals);

      if (reservedAmountRaw < recipientTotalRaw) {
        throw new Error("Reserved amount must be greater than or equal to the sum paid each execution.");
      }

      const recipients = values.recipients.map((recipient) => ({
        address: parsePublicKeyString(recipient.address),
        amount: decimalToRawAmount(recipient.amount, decimals),
      }));

      const { signature, scheduleId } = await client.createScheduleFromRecipients({
        tokenMint: parsePublicKeyString(selectedVault.tokenMint.address),
        recipients,
        intervalSecs: values.intervalSecs,
        reservedAmount: toAnchorBn(reservedAmountRaw),
        perExecutionAmount: toAnchorBn(recipientTotalRaw),
      });

      const { schedulePda } = deriveSchedulePdaFromMint(wallet.publicKey, parsePublicKeyString(selectedVault.tokenMint.address), scheduleId);

      const payload = {
        schedulePda: schedulePda.toBase58(),
        scheduleId,
        vaultEmployer: wallet.publicKey.toBase58(),
        tokenMint: selectedVault.tokenMint.address,
        recipients: recipients.map((recipient) => ({
          address: recipient.address.toBase58(),
          amount: recipient.amount.toString(),
        })),
      };

      storePendingRegistration(payload);

      if (values.autoRegister) {
        await registerMutation.mutateAsync(payload);
      }

      startTransition(() => {
        router.push(`/schedules/${schedulePda.toBase58()}?signature=${signature}`);
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create schedule.");
    }
  }

  return (
    <AppShell coordinatorStatus={coordinatorStatus}>
      <div className="space-y-6">
        <SectionHeader
          eyebrow="Create Schedule"
          title="Compose a payout schedule"
          description="Choose a vault, set the cadence, and define recipients. Per-cycle amount is derived from the rows below."
          action={
            <Button asChild variant="ghost">
              <Link href="/schedules">Back to schedules</Link>
            </Button>
          }
        />

        {!wallet ? (
          <WalletGate />
        ) : !vaults.data?.length ? (
          <EmptyState
            title="Create a vault first"
            description="Schedules are mint-specific, so you need at least one funded vault before you can create one."
            action={
              <Button asChild>
                <Link href="/vaults">Create vault</Link>
              </Button>
            }
          />
        ) : (
          <form className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]" onSubmit={form.handleSubmit(onSubmit)}>
            <Card>
              <CardHeader className="border-b border-border/70">
                <CardTitle>Recipients and cadence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="vaultMint">
                      Funding vault
                    </label>
                    <select
                      className="app-select"
                      id="vaultMint"
                      {...form.register("vaultMint")}
                    >
                      <option value="">Select vault</option>
                      {vaults.data.map((vault) => (
                        <option key={vault.publicKey} value={vault.tokenMint.address}>
                          {vault.tokenMint.symbol} · available {rawAmountToDecimal(vault.availableRaw, vault.tokenMint.decimals)}
                        </option>
                      ))}
                    </select>
                    {form.formState.errors.vaultMint ? <p className="text-xs text-destructive">{form.formState.errors.vaultMint.message}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="intervalSecs">
                      Interval (seconds)
                    </label>
                    <Input id="intervalSecs" type="number" {...form.register("intervalSecs")} error={form.formState.errors.intervalSecs?.message} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="reservedAmount">
                    Reserved amount
                  </label>
                  <Input
                    id="reservedAmount"
                    placeholder={selectedVault ? `${selectedVault.tokenMint.symbol} amount` : "Select a vault first"}
                    {...form.register("reservedAmount")}
                    error={form.formState.errors.reservedAmount?.message}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Recipients</p>
                    <Button
                      onClick={() => append({ address: "", amount: "" })}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Add recipient
                    </Button>
                  </div>

                  {fields.map((field, index) => (
                    <div key={field.id} className="grid gap-3 rounded-3xl border border-border/70 bg-muted/35 p-4 md:grid-cols-[minmax(0,1fr)_160px_auto]">
                      <Input
                        {...form.register(`recipients.${index}.address`)}
                        error={form.formState.errors.recipients?.[index]?.address?.message}
                        placeholder="Recipient public key"
                      />
                      <Input
                        {...form.register(`recipients.${index}.amount`)}
                        error={form.formState.errors.recipients?.[index]?.amount?.message}
                        placeholder="0.00"
                      />
                      <Button onClick={() => remove(index)} size="sm" type="button" variant="ghost">
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="h-fit">
              <CardHeader className="border-b border-border/70">
                <CardTitle>Execution summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <div className="space-y-3 rounded-3xl border border-border/70 bg-muted/45 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Per execution</span>
                    <span className="font-semibold">
                      {selectedVault ? `${rawAmountToDecimal(recipientTotalRaw, selectedVault.tokenMint.decimals)} ${selectedVault.tokenMint.symbol}` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Recipients</span>
                    <span className="font-semibold">{form.watch("recipients").length}</span>
                  </div>
                  {selectedVault ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Selected vault</span>
                      <Badge tone="accent">{selectedVault.tokenMint.symbol}</Badge>
                    </div>
                  ) : null}
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-3xl border border-border/70 bg-muted/45 px-4 py-3 text-sm">
                  <input className="size-4" type="checkbox" {...form.register("autoRegister")} />
                  Auto-register with coordinator after creation
                </label>

                {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

                <Button className="w-full" disabled={form.formState.isSubmitting} type="submit">
                  {form.formState.isSubmitting ? "Creating schedule…" : "Create schedule"}
                </Button>

                <p className="text-xs leading-6 text-muted-foreground">
                  Registration payloads are cached in the current browser session so failed coordinator registration can be retried from the detail page.
                </p>
              </CardContent>
            </Card>
          </form>
        )}
      </div>
    </AppShell>
  );
}

function parsePublicKeyString(value: string) {
  return new PublicKey(value);
}

function toAnchorBn(value: bigint) {
  return new BN(value.toString());
}
