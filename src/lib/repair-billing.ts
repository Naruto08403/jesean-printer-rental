import { summarizePayments } from "@/lib/payments";
import {
  formatRepairCustomerLabel,
  formatRepairPrinterLabel,
  repairDisplayTitle,
} from "@/lib/repair-device";
import { generateRepairBillingPdf as renderRepairBillingPdf } from "@/lib/repair-billing-pdf";
import { generateRepairBillingDocx as renderRepairBillingDocx} from "./generate-billing-docx";
import { listActiveRepairDiagnosisCatalog } from "@/actions/repair-diagnoses";
import type { RepairTemplateLineItem } from "@/lib/repair-billing-lines";
import { toRepairBillingRecord } from "@/lib/repair-billing-record";

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

export type RepairBillingSourceRepair = {
  id: string;
  receivedAt: Date;
  completedAt?: Date | null;
  problem: string;
  diagnosis?: string | null;
  totalAmount: number;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  printer?: { brand: string | null; model: string | null; serialNumber: string | null } | null;
  payments: { amount: number }[];
  pricingMode?: "CATALOG" | "GENERAL";
  diagnosisLines?: { name: string; price: number; sortOrder?: number }[];
};

export function buildRepairBillingLine(repair: RepairBillingSourceRepair): RepairBillingLine {
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
  repairs: RepairBillingSourceRepair[];
}): RepairBillingStatement & { repairs: typeof input.repairs } {
  return {
    clientName: input.clientName,
    issueDate: input.issueDate,
    lines: input.repairs.map(buildRepairBillingLine),
    repairs: input.repairs,
  };
}

function mapRepairToBillingRecord(repair: RepairBillingSourceRepair) {
  return toRepairBillingRecord({
    id: repair.id,
    receivedAt: repair.receivedAt,
    completedAt: repair.completedAt ?? null,
    brand: repair.brand ?? null,
    model: repair.model ?? null,
    serialNumber: repair.serialNumber ?? null,
    problem: repair.problem,
    diagnosis: repair.diagnosis ?? null,
    totalAmount: repair.totalAmount,
    pricingMode: repair.pricingMode,
    printer: repair.printer ?? null,
    diagnosisLines: repair.diagnosisLines,
  });
}

export async function generateRepairBillingPdf(
  statement: RepairBillingStatement & {
    repairs?: RepairBillingSourceRepair[];
    billingStatementItems?: RepairTemplateLineItem[];
    jobOrderItems?: RepairTemplateLineItem[];
  }
): Promise<Buffer> {
  if (!statement.repairs?.length) {
    throw new Error("Repair billing requires source repair records");
  }

  const { repairs, billingStatementItems, jobOrderItems, ...rest } = statement;
  const diagnosisCatalog = await listActiveRepairDiagnosisCatalog();
  const billingRepairs = repairs.map(mapRepairToBillingRecord);

  return renderRepairBillingPdf({
    ...rest,
    repairs: billingRepairs,
    diagnosisCatalog,
    billingStatementItems,
    jobOrderItems,
  });
}

export async function generateRepairBillingDocx(
  statement: RepairBillingStatement & {
    repairs?: RepairBillingSourceRepair[];
    billingStatementItems?: RepairTemplateLineItem[];
    jobOrderItems?: RepairTemplateLineItem[];
  }
): Promise<Buffer> {
  if (!statement.repairs?.length) {
    throw new Error("Repair billing requires source repair records");
  }

  const { repairs, billingStatementItems, jobOrderItems, ...rest } = statement;

  const diagnosisCatalog = await listActiveRepairDiagnosisCatalog();

  const billingRepairs = repairs.map(mapRepairToBillingRecord);

  return renderRepairBillingDocx({
    ...rest,
    repairs: billingRepairs,
    diagnosisCatalog,
    billingStatementItems,
    jobOrderItems,
  });
}

/** @deprecated Use generateRepairBillingPdf */
export async function generateRepairBillingExcel(
  statement: RepairBillingStatement & {
    repairs?: RepairBillingSourceRepair[];
  }
): Promise<Buffer> {
  // return generateRepairBillingPdf(statement);
  return generateRepairBillingDocx(statement);
}

export function repairCustomerDisplayName(repair: {
  client?: { name: string } | null;
  customerName?: string | null;
}): string {
  return formatRepairCustomerLabel(repair);
}
