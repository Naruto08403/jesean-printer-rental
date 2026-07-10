import { summarizePayments } from "@/lib/payments";
import {
  formatRepairCustomerLabel,
  formatRepairPrinterLabel,
  repairDisplayTitle,
} from "@/lib/repair-device";
import { generateRepairBillingPdfFromTemplate } from "@/lib/repair-billing-pdf";
import { listActiveRepairDiagnosisCatalog } from "@/actions/repair-diagnoses";
import type { RepairTemplateLineItem } from "@/lib/repair-billing-lines";

export type RepairBillingLine = {
  id: string;
  receivedAt: Date;
  printerLabel: string;
  problem: string;
  totalAmount: number;
  paid: number;
  balance: number;
};

export type RepairBillingStatement = {
  clientName: string;
  issueDate: Date;
  lines: RepairBillingLine[];
};

export function repairBillingFilename(clientName: string, issueDate: Date): string {
  const safe = clientName.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "client";
  const d = `${issueDate.getFullYear()}-${String(issueDate.getMonth() + 1).padStart(2, "0")}-${String(issueDate.getDate()).padStart(2, "0")}`;
  return `repair-billing-${safe}-${d}.pdf`;
}

export function repairBillingFilenameExcel(clientName: string, issueDate: Date): string {
  const safe = clientName.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "client";
  const d = `${issueDate.getFullYear()}-${String(issueDate.getMonth() + 1).padStart(2, "0")}-${String(issueDate.getDate()).padStart(2, "0")}`;
  return `repair-billing-${safe}-${d}.xlsx`;
}

export function buildRepairBillingLine(repair: {
  id: string;
  receivedAt: Date;
  problem: string;
  diagnosis?: string | null;
  totalAmount: number;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  printer?: { brand: string | null; model: string | null; serialNumber: string | null } | null;
  payments: { amount: number }[];
}): RepairBillingLine {
  const summary = summarizePayments(repair.totalAmount, repair.payments);
  return {
    id: repair.id,
    receivedAt: repair.receivedAt,
    printerLabel: formatRepairPrinterLabel(repair),
    problem: repairDisplayTitle(repair),
    totalAmount: summary.total,
    paid: summary.paid,
    balance: summary.balance,
  };
}

export function prepareRepairBillingStatement(input: {
  clientName: string;
  issueDate: Date;
  repairs: Parameters<typeof buildRepairBillingLine>[0][];
}): RepairBillingStatement & { repairs: typeof input.repairs } {
  return {
    clientName: input.clientName,
    issueDate: input.issueDate,
    lines: input.repairs.map(buildRepairBillingLine),
    repairs: input.repairs,
  };
}

export async function generateRepairBillingPdf(
  statement: RepairBillingStatement & {
    repairs?: Parameters<typeof buildRepairBillingLine>[0][];
    billingStatementItems?: RepairTemplateLineItem[];
    jobOrderItems?: RepairTemplateLineItem[];
  }
): Promise<Buffer> {
  if (!statement.repairs?.length) {
    throw new Error("Repair billing requires source repair records");
  }

  const { repairs, billingStatementItems, jobOrderItems, ...rest } = statement;
  const diagnosisCatalog = await listActiveRepairDiagnosisCatalog();

  return generateRepairBillingPdfFromTemplate({
    ...rest,
    repairs,
    diagnosisCatalog,
    billingStatementItems,
    jobOrderItems,
  });
}

/** @deprecated Use generateRepairBillingPdf */
export async function generateRepairBillingExcel(
  statement: RepairBillingStatement & {
    repairs?: Parameters<typeof buildRepairBillingLine>[0][];
  }
): Promise<Buffer> {
  return generateRepairBillingPdf(statement);
}

export function repairCustomerDisplayName(repair: {
  client?: { name: string } | null;
  customerName?: string | null;
}): string {
  return formatRepairCustomerLabel(repair);
}
