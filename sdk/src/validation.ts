import { BN } from "@coral-xyz/anchor";
import type { Recipient } from "./merkle";
import type { CreateScheduleParams, UpdateScheduleParams } from "./types";

export const MIN_SCHEDULE_INTERVAL_SECS = 60 * 60;
export const MAX_SCHEDULE_INTERVAL_SECS = 31 * 24 * 60 * 60;
export const MAX_SCHEDULE_RECIPIENTS = 1024;

export function assertValidCreateScheduleParams(params: CreateScheduleParams): void {
    if (params.scheduleId.length !== 32) {
        throw new Error("scheduleId must be 32 bytes");
    }
    if (params.erJobId.length !== 32) {
        throw new Error("erJobId must be 32 bytes");
    }
    if (
        !Number.isInteger(params.intervalSecs) ||
        params.intervalSecs < MIN_SCHEDULE_INTERVAL_SECS ||
        params.intervalSecs > MAX_SCHEDULE_INTERVAL_SECS
    ) {
        throw new Error(
            `intervalSecs must be between ${MIN_SCHEDULE_INTERVAL_SECS} and ${MAX_SCHEDULE_INTERVAL_SECS}`
        );
    }
    if (params.totalRecipients <= 0 || params.totalRecipients > MAX_SCHEDULE_RECIPIENTS) {
        throw new Error(`totalRecipients must be between 1 and ${MAX_SCHEDULE_RECIPIENTS}`);
    }
    if (params.reservedAmount.lte(new BN(0))) {
        throw new Error("reservedAmount must be greater than 0");
    }
    if (params.perExecutionAmount.lte(new BN(0))) {
        throw new Error("perExecutionAmount must be greater than 0");
    }
    if (params.perExecutionAmount.gt(params.reservedAmount)) {
        throw new Error("perExecutionAmount cannot exceed reservedAmount");
    }
    if (params.merkleRoot.length !== 32) {
        throw new Error("merkleRoot must be 32 bytes");
    }
}

export function assertRecipientsMatchPerExecutionAmount(
    recipients: Recipient[],
    perExecutionAmount: BN
): void {
    if (recipients.length === 0) {
        throw new Error("at least one recipient is required");
    }
    if (recipients.length > MAX_SCHEDULE_RECIPIENTS) {
        throw new Error(`recipients exceed max supported count of ${MAX_SCHEDULE_RECIPIENTS}`);
    }

    let total = 0n;
    for (const recipient of recipients) {
        if (recipient.amount <= 0n) {
            throw new Error("recipient amounts must be greater than 0");
        }
        total += recipient.amount;
    }

    if (total !== BigInt(perExecutionAmount.toString())) {
        throw new Error("sum of recipient amounts must equal perExecutionAmount");
    }
}

export function assertValidUpdateScheduleParams(params: UpdateScheduleParams): void {
    if (
        !Number.isInteger(params.intervalSecs) ||
        params.intervalSecs < MIN_SCHEDULE_INTERVAL_SECS ||
        params.intervalSecs > MAX_SCHEDULE_INTERVAL_SECS
    ) {
        throw new Error(
            `intervalSecs must be between ${MIN_SCHEDULE_INTERVAL_SECS} and ${MAX_SCHEDULE_INTERVAL_SECS}`
        );
    }
    if (params.totalRecipients <= 0 || params.totalRecipients > MAX_SCHEDULE_RECIPIENTS) {
        throw new Error(`totalRecipients must be between 1 and ${MAX_SCHEDULE_RECIPIENTS}`);
    }
    if (params.reservedAmount.lte(new BN(0))) {
        throw new Error("reservedAmount must be greater than 0");
    }
    if (params.perExecutionAmount.lte(new BN(0))) {
        throw new Error("perExecutionAmount must be greater than 0");
    }
    if (params.perExecutionAmount.gt(params.reservedAmount)) {
        throw new Error("perExecutionAmount cannot exceed reservedAmount");
    }
    if (params.merkleRoot.length !== 32) {
        throw new Error("merkleRoot must be 32 bytes");
    }
}
