"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { BN } from "@coral-xyz/anchor";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { ArrowLeft, BookmarkSimple, CaretDown, FloppyDisk, Info, Trash, UploadSimple, X } from "phosphor-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { SectionHeader } from "@/components/section-header";
import { WalletGate } from "@/components/wallet-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useConfigQuery, useCoordinatorHealthQuery, useEmployerVaultsQuery, useRegisterScheduleMutation } from "@/hooks/use-dashboard-data";
import { notify, userFacingError } from "@/lib/notify";
import { paginateItems } from "@/lib/pagination";
import { storePendingRegistration } from "@/lib/pending-registrations";
import { parseRecipientCsvFile, parseRecipientExcelFile } from "@/lib/recipient-import";
import {
  deleteScheduleTemplate,
  listScheduleTemplates,
  saveScheduleTemplate,
  type ScheduleTemplate,
} from "@/lib/schedule-templates";
import { decimalToRawAmount, rawAmountToDecimal } from "@/lib/token";
import { formatAddress } from "@/lib/format";
import { deriveSchedulePdaFromMint } from "@/lib/veil";
import { useVeilClient } from "@/hooks/use-veil-client";

const recipientSchema = z.object({
  address: z.string().min(32, "Recipient address is required"),
  amount: z.string().min(1, "Amount is required"),
});

const intervalUnitSchema = z.enum(["hours", "days"]);

const formSchema = z
  .object({
    vaultMint: z.string().min(1, "Select a funded vault"),
    intervalValue: z.coerce.number().int().min(1, "Enter an interval greater than zero."),
    intervalUnit: intervalUnitSchema,
    reservedAmount: z.string().min(1, "Reserved amount is required"),
    autoRegister: z.boolean(),
    recipients: z.array(recipientSchema).min(1, "At least one recipient is required"),
  })
  .superRefine((values, ctx) => {
    const intervalSecs = toIntervalSecs(values.intervalValue, values.intervalUnit);

    if (intervalSecs < 3600 || intervalSecs > 31 * 24 * 60 * 60) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Interval must be between 1 hour and 31 days.",
        path: ["intervalValue"],
      });
    }
  });

type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

export function ScheduleBuilderScreen() {
  const router = useRouter();
  const wallet = useAnchorWallet();
  const client = useVeilClient();
  const vaults = useEmployerVaultsQuery();
  const config = useConfigQuery();
  const coordinatorHealth = useCoordinatorHealthQuery();
  const registerMutation = useRegisterScheduleMutation("pending");
  const walletAddress = wallet?.publicKey.toBase58();
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [uploadType, setUploadType] = useState<"csv" | "excel" | null>(null);
  const [recipientPage, setRecipientPage] = useState(1);
  const uploadMenuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingUploadTypeRef = useRef<"csv" | "excel" | null>(null);

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
      intervalValue: 24,
      intervalUnit: "hours",
      reservedAmount: "",
      autoRegister: true,
      recipients: [{ address: "", amount: "" }],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "recipients",
  });

  const selectedVault = vaults.data?.find((vault) => vault.tokenMint.address === form.watch("vaultMint")) ?? null;
  const reservedAmountValue = form.watch("reservedAmount");
  const recipientTotalRaw =
    selectedVault?.tokenMint.decimals !== undefined
      ? form
          .watch("recipients")
          .reduce(
            (total, recipient) => total + decimalToRawAmount(recipient.amount || "0", selectedVault.tokenMint.decimals),
            BigInt(0),
          )
      : BigInt(0);
  const reservedAmountRaw =
    selectedVault?.tokenMint.decimals !== undefined ? decimalToRawAmount(reservedAmountValue || "0", selectedVault.tokenMint.decimals) : BigInt(0);
  const reservedAmountTooHigh = selectedVault ? reservedAmountRaw > selectedVault.availableRaw : false;
  const reservedAmountTooLow = selectedVault ? reservedAmountRaw > BigInt(0) && reservedAmountRaw < recipientTotalRaw : false;
  const maxRecipients = Math.min(config.data?.maxRecipients ?? 1000, 1000);
  const paginatedRecipients = paginateItems(
    fields.map((field, index) => ({ field, index })),
    recipientPage,
    10,
  );

  useEffect(() => {
    setTemplates(walletAddress ? listScheduleTemplates(walletAddress) : []);
  }, [walletAddress]);

  useEffect(() => {
    if (!uploadMenuOpen) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (uploadMenuRef.current?.contains(event.target as Node)) {
        return;
      }

      setUploadMenuOpen(false);
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setUploadMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [uploadMenuOpen]);

  async function onSubmit(values: FormValues) {
    if (!client || !wallet || !selectedVault) {
      notify("Connect a wallet and choose a vault first.", "error");
      return;
    }

    try {
      const decimals = selectedVault.tokenMint.decimals;
      const reservedAmountRaw = decimalToRawAmount(values.reservedAmount, decimals);
      const intervalSecs = toIntervalSecs(values.intervalValue, values.intervalUnit);

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
        intervalSecs,
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

      let registrationNeedsRetry = false;
      if (values.autoRegister) {
        try {
          await registerMutation.mutateAsync(payload);
        } catch {
          registrationNeedsRetry = true;
        }
      }

      notify(registrationNeedsRetry ? "Schedule created. Coordinator registration needs retry." : "Schedule created.", registrationNeedsRetry ? "warn" : "success");

      startTransition(() => {
        router.push(signature ? `/schedules/${schedulePda.toBase58()}?signature=${signature}` : `/schedules/${schedulePda.toBase58()}`);
      });
    } catch (error) {
      notify(userFacingError(error, "Could not create the schedule. Try again."), "error");
    }
  }

  async function handleRecipientFile(file: File) {
    try {
      const selectedUploadType = pendingUploadTypeRef.current;
      if (!selectedUploadType) {
        throw new Error("Choose a file type first.");
      }

      const importedRecipients =
        selectedUploadType === "excel"
          ? await parseRecipientExcelFile(file, maxRecipients)
          : await parseRecipientCsvFile(file, maxRecipients);

      if (!importedRecipients) {
        return;
      }

      replace(importedRecipients);
      setRecipientPage(1);
      notify(`${importedRecipients.length} recipients imported.`, "success");
    } catch (error) {
      notify(userFacingError(error, "Could not import recipients."), "error");
    } finally {
      setUploadMenuOpen(false);
      setUploadType(null);
      pendingUploadTypeRef.current = null;

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleSaveTemplate() {
    if (!walletAddress) {
      notify("Connect a wallet before saving templates.", "error");
      return;
    }

    if (!templateName.trim()) {
      notify("Name this template first.", "error");
      return;
    }

    const result = formSchema.safeParse(form.getValues());
    if (!result.success) {
      notify("Complete the schedule details before saving a template.", "error");
      return;
    }

    try {
      const template = saveScheduleTemplate({
        wallet: walletAddress,
        name: templateName,
        tokenMint: result.data.vaultMint,
        intervalValue: result.data.intervalValue,
        intervalUnit: result.data.intervalUnit,
        reservedAmount: result.data.reservedAmount,
        recipients: result.data.recipients,
      });

      setTemplates(listScheduleTemplates(walletAddress));
      setTemplateName("");
      notify(`Template saved: ${template.name}`, "success");
    } catch (error) {
      notify(userFacingError(error, "Could not save this template."), "error");
    }
  }

  function handleApplyTemplate(template: ScheduleTemplate) {
    if (template.recipients.length > maxRecipients) {
      notify(`This template has more than ${maxRecipients} recipients.`, "error");
      return;
    }

    const hasVaultForTemplate = Boolean(vaults.data?.some((vault) => vault.tokenMint.address === template.tokenMint));
    form.reset({
      vaultMint: hasVaultForTemplate ? template.tokenMint : "",
      intervalValue: template.intervalValue,
      intervalUnit: template.intervalUnit,
      reservedAmount: template.reservedAmount,
      autoRegister: form.getValues("autoRegister"),
      recipients: template.recipients,
    });
    setRecipientPage(1);
    setTemplatePickerOpen(false);

    notify(
      hasVaultForTemplate ? `Template applied: ${template.name}` : "Template applied. Create a vault for this mint first.",
      hasVaultForTemplate ? "success" : "warn",
    );
  }

  function handleDeleteTemplate(templateId: string) {
    if (!walletAddress) {
      return;
    }

    deleteScheduleTemplate(walletAddress, templateId);
    setTemplates(listScheduleTemplates(walletAddress));
    notify("Template deleted.", "success");
  }

  function getTemplateMintLabel(tokenMint: string) {
    const vault = vaults.data?.find((item) => item.tokenMint.address === tokenMint);
    return vault?.tokenMint.symbol ?? formatAddress(tokenMint, 5);
  }

  return (
    <AppShell coordinatorStatus={coordinatorStatus}>
      <div className="space-y-6">
        <SectionHeader
          eyebrow="Create Schedule"
          title="Compose a payout schedule"
          description="Choose a vault, set the cadence, and define recipients. Per-cycle amount is derived from the rows below."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={!wallet}
                onClick={() => setTemplatePickerOpen(true)}
                type="button"
                variant="secondary"
              >
                <BookmarkSimple size={16} weight="bold" />
                Use template
              </Button>
              <Button asChild variant="ghost">
                <Link href="/schedules">
                  <ArrowLeft size={16} weight="bold" />
                  Back to schedules
                </Link>
              </Button>
            </div>
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
                    <label className="text-sm font-medium" htmlFor="intervalValue">
                      Interval
                    </label>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                      <Input id="intervalValue" type="number" {...form.register("intervalValue")} error={form.formState.errors.intervalValue?.message} />
                      <select className="app-select" {...form.register("intervalUnit")}>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium" htmlFor="reservedAmount">
                    <span>Reserved amount</span>
                    <HelpHint text="This is the total amount set aside in the vault for this schedule. It must cover at least one full payout cycle." />
                  </label>
                  <Input
                    id="reservedAmount"
                    placeholder={selectedVault ? `${selectedVault.tokenMint.symbol} amount` : "Select a vault first"}
                    {...form.register("reservedAmount")}
                    error={form.formState.errors.reservedAmount?.message}
                  />
                  {reservedAmountTooHigh ? (
                    <p className="text-xs text-destructive">Reserved amount exceeds the vault&apos;s available balance.</p>
                  ) : null}
                  {reservedAmountTooLow ? (
                    <p className="text-xs text-destructive">Reserved amount must cover at least one full execution.</p>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">Recipients</p>
                      <HelpHint text="Add one recipient per row. For uploads, use two columns: address and amount. A header row is allowed." />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        className="hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        disabled={fields.length === 0}
                        onClick={() => {
                          replace([{ address: "", amount: "" }]);
                          setRecipientPage(1);
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash size={16} weight="bold" />
                        Delete all
                      </Button>
                      <div className="relative" ref={uploadMenuRef}>
                        <Button
                          onClick={() => setUploadMenuOpen((current) => !current)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          <UploadSimple size={16} weight="bold" />
                          Upload
                          <CaretDown size={14} weight="bold" />
                        </Button>
                        {uploadMenuOpen ? (
                          <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 min-w-[180px] rounded-lg border border-border bg-card p-2 shadow-(--shadow-panel)">
                            <button
                              className="flex w-full items-center rounded-2xl px-3 py-2 text-left text-sm font-medium transition hover:bg-muted/70"
                              onClick={() => {
                                pendingUploadTypeRef.current = "excel";
                                setUploadType("excel");
                                fileInputRef.current?.click();
                              }}
                              type="button"
                            >
                              Excel
                            </button>
                            <button
                              className="flex w-full items-center rounded-2xl px-3 py-2 text-left text-sm font-medium transition hover:bg-muted/70"
                              onClick={() => {
                                pendingUploadTypeRef.current = "csv";
                                setUploadType("csv");
                                fileInputRef.current?.click();
                              }}
                              type="button"
                            >
                              CSV
                            </button>
                          </div>
                        ) : null}
                        <input
                          accept={
                            uploadType === "excel"
                              ? ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                              : ".csv,text/csv"
                          }
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) {
                              return;
                            }

                            void handleRecipientFile(file);
                          }}
                          ref={fileInputRef}
                          type="file"
                        />
                      </div>
                      <Button
                        disabled={fields.length >= maxRecipients}
                        onClick={() => {
                          if (fields.length >= maxRecipients) {
                            notify(`You can add up to ${maxRecipients} recipients in one schedule.`, "error");
                            return;
                          }

                          append({ address: "", amount: "" });
                          setRecipientPage(Math.ceil((fields.length + 1) / 10));
                        }}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        Add recipient
                      </Button>
                    </div>
                  </div>

                  {paginatedRecipients.pageItems.map(({ field, index }) => (
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
                      <Button
                        onClick={() => {
                          remove(index);
                          const nextTotal = fields.length - 1;
                          const nextPageCount = Math.max(1, Math.ceil(nextTotal / 10));
                          setRecipientPage((current) => Math.min(current, nextPageCount));
                        }}
                        className="hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}

                  {fields.length > 10 ? (
                    <div className="flex flex-col gap-3 border-t border-border/70 pt-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        Showing {(paginatedRecipients.currentPage - 1) * 10 + 1}-
                        {Math.min(paginatedRecipients.currentPage * 10, fields.length)} of {fields.length} recipients
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          disabled={!paginatedRecipients.hasPreviousPage}
                          onClick={() => setRecipientPage((current) => Math.max(1, current - 1))}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Previous
                        </Button>
                        <div className="flex items-center gap-2">
                          {paginatedRecipients.pageNumbers.map((pageNumber) => (
                            <Button
                              className="min-w-10"
                              key={pageNumber}
                              onClick={() => setRecipientPage(pageNumber)}
                              size="sm"
                              type="button"
                              variant={pageNumber === paginatedRecipients.currentPage ? "secondary" : "ghost"}
                            >
                              {pageNumber}
                            </Button>
                          ))}
                        </div>
                        <Button
                          disabled={!paginatedRecipients.hasNextPage}
                          onClick={() => setRecipientPage((current) => current + 1)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  ) : null}
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
                  {selectedVault ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Available now</span>
                      <span className="font-semibold">
                        {rawAmountToDecimal(selectedVault.availableRaw, selectedVault.tokenMint.decimals)} {selectedVault.tokenMint.symbol}
                      </span>
                    </div>
                  ) : null}
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-3xl border border-border/70 bg-muted/45 px-4 py-3 text-sm">
                  <input className="size-4" type="checkbox" {...form.register("autoRegister")} />
                  Auto-register with coordinator after creation
                </label>

                <div className="space-y-3 rounded-3xl border border-border/70 bg-muted/35 p-4">
                  <div>
                    <p className="text-sm font-semibold">Save as template</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Store this draft for this wallet and reuse it later.
                    </p>
                  </div>
                  <Input
                    onChange={(event) => setTemplateName(event.target.value)}
                    placeholder="Template name"
                    value={templateName}
                  />
                  <Button
                    className="w-full"
                    onClick={handleSaveTemplate}
                    type="button"
                    variant="secondary"
                  >
                    <FloppyDisk size={16} weight="bold" />
                    Save template
                  </Button>
                </div>

                <Button className="w-full" disabled={form.formState.isSubmitting || reservedAmountTooHigh || reservedAmountTooLow} type="submit">
                  {form.formState.isSubmitting ? "Creating schedule…" : "Create schedule"}
                </Button>

                <p className="text-xs leading-6 text-muted-foreground">
                  Registration payloads are cached in the current browser session so failed coordinator registration can be retried from the detail page.
                </p>
              </CardContent>
            </Card>
          </form>
        )}

        {templatePickerOpen ? (
          <TemplatePickerDialog
            getMintLabel={getTemplateMintLabel}
            onApply={handleApplyTemplate}
            onClose={() => setTemplatePickerOpen(false)}
            onDelete={handleDeleteTemplate}
            templates={templates}
          />
        ) : null}
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

function toIntervalSecs(value: number, unit: "hours" | "days") {
  return value * (unit === "days" ? 24 * 60 * 60 : 60 * 60);
}

function HelpHint({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <span className="inline-flex size-4 cursor-help items-center justify-center rounded-full border border-border/70 text-muted-foreground transition group-hover:border-border group-hover:text-foreground">
        <Info size={11} weight="bold" />
      </span>
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+0.5rem)] z-20 w-64 -translate-x-1/2 rounded-2xl border border-border bg-card px-3 py-2 text-xs font-medium leading-5 text-card-foreground opacity-0 shadow-(--shadow-panel) transition duration-150 group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

function TemplatePickerDialog({
  templates,
  getMintLabel,
  onApply,
  onClose,
  onDelete,
}: {
  templates: ScheduleTemplate[];
  getMintLabel: (tokenMint: string) => string;
  onApply: (template: ScheduleTemplate) => void;
  onClose: () => void;
  onDelete: (templateId: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-xl">
      <div className="panel max-h-[min(760px,90vh)] w-full max-w-3xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-border/70 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Templates
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Create from a saved schedule</h2>
          </div>
          <Button onClick={onClose} size="sm" type="button" variant="ghost">
            <X size={16} weight="bold" />
          </Button>
        </div>

        <div className="max-h-[calc(min(760px,90vh)-120px)] overflow-y-auto p-5">
          {!templates.length ? (
            <div className="rounded-3xl border border-border/70 bg-muted/35 p-6">
              <p className="text-base font-semibold">No templates yet</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Fill the schedule form once, save it as a template, and it will show up here for this wallet.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {templates.map((template) => (
                <div
                  className="grid gap-4 rounded-3xl border border-border/70 bg-muted/35 p-4 transition hover:border-accent/45 hover:bg-muted/50 lg:grid-cols-[minmax(0,1fr)_auto]"
                  key={template.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-semibold">{template.name}</p>
                      <Badge tone="accent">{getMintLabel(template.tokenMint)}</Badge>
                    </div>
                    <div className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                      <TemplateMeta label="Recipients" value={String(template.recipients.length)} />
                      <TemplateMeta label="Cadence" value={`Every ${template.intervalValue} ${template.intervalUnit}`} />
                      <TemplateMeta label="Reserve" value={template.reservedAmount} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 lg:justify-end">
                    <Button onClick={() => onApply(template)} size="sm" type="button">
                      Apply
                    </Button>
                    <Button
                      className="hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onDelete(template.id)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash size={15} weight="bold" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-semibold text-foreground">{value}</p>
    </div>
  );
}
