import * as XLSX from "xlsx";
import { notify } from "@/lib/notify";

export interface ImportedRecipientRow {
  address: string;
  amount: string;
}

const MAX_IMPORT_RECIPIENTS = 1000;

export async function parseRecipientCsvFile(file: File, maxRecipients: number) {
  return parseRecipientFile(file, "csv", maxRecipients);
}

export async function parseRecipientExcelFile(file: File, maxRecipients: number) {
  return parseRecipientFile(file, "excel", maxRecipients);
}

async function parseRecipientFile(file: File, kind: "csv" | "excel", maxRecipients: number) {
  try {
    const hardLimit = Math.min(maxRecipients, MAX_IMPORT_RECIPIENTS);
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
      type: "array",
      raw: false,
      dense: true,
    });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      notify("That file is empty.", "error");
      return null;
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      blankrows: false,
      raw: false,
    });

    const normalizedRows = rows
      .map((row) => row.map((value) => (value == null ? "" : String(value).trim())))
      .filter((row) => row.some((value) => value.length > 0));

    if (!normalizedRows.length) {
      notify(`No recipient rows were found in that ${kind === "excel" ? "spreadsheet" : "CSV"} file.`, "error");
      return null;
    }

    const contentRows = isHeaderRow(normalizedRows[0]) ? normalizedRows.slice(1) : normalizedRows;
    const recipients = contentRows
      .map((row, index) => toRecipientRow(row, index))
      .filter((row): row is ImportedRecipientRow => row !== null);

    if (!recipients.length) {
      notify("No valid recipients were found. Use address and amount columns.", "error");
      return null;
    }

    if (recipients.length > hardLimit) {
      notify(`You can import up to ${hardLimit} recipients at once.`, "error");
      return null;
    }

    return recipients;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Row ")) {
      notify(`${error.message} is missing an address or amount.`, "error");
      return null;
    }

    notify("Could not read that file. Check the format and try again.", "error");
    return null;
  }
}

function isHeaderRow(row: string[]) {
  const [first = "", second = ""] = row.map((value) => value.toLowerCase());
  return (
    first.includes("address") ||
    first.includes("recipient") ||
    second.includes("amount")
  );
}

function toRecipientRow(row: string[], index: number) {
  const address = row[0]?.trim() ?? "";
  const amount = row[1]?.trim() ?? "";

  if (!address && !amount) {
    return null;
  }

  if (!address || !amount) {
    throw new Error(`Row ${index + 1}`);
  }

  return {
    address,
    amount,
  };
}
