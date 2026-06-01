import { getClientPaymentSuggestion } from "@/lib/rental-annual";
import type { PaymentSchedule, PrinterStatus, RentalStatus } from "@prisma/client";

export const MONTH_NAMES_UPPER = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
] as const;

export const MAX_BILLING_MONTHS = 6;

export type BillingRentalUnit = {
  status: RentalStatus;
  ratePerPeriod: number;
  paymentSchedule: PaymentSchedule;
  printer: {
    brand: string | null;
    model: string | null;
    status: PrinterStatus;
    price: number | null;
  } | null;
};

export type GenerateBillingInput = {
  clientName: string;
  issueDate: Date;
  year: number;
  startMonth: number;
  endMonth: number;
  rentals: BillingRentalUnit[];
  representativeName?: string;
};

export type BillingStatementData = {
  clientName: string;
  customerLine: string;
  issueDateLabel: string;
  unitDescription: string;
  representative: string;
  months: { label: string; amount: number }[];
  total: number;
  monthlyPayable: number;
  unitCount: number;
};

export function buildUnitDescription(rentals: BillingRentalUnit[]): string {
  const active = rentals.filter((r) => r.status === "ACTIVE" || r.status === "PAUSED");
  const counts = new Map<string, number>();

  for (const rental of active) {
    const label =
      [rental.printer?.brand, rental.printer?.model].filter(Boolean).join(" ") || "Printer";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => `${count} ${label}`)
    .join(" and ");
}

export function formatMonthsCoveredLabel(year: number, startMonth: number, endMonth: number) {
  if (startMonth === endMonth) {
    return `${MONTH_NAMES_UPPER[startMonth]} ${year}`;
  }
  return `${MONTH_NAMES_UPPER[startMonth]}-${MONTH_NAMES_UPPER[endMonth]} ${year}`;
}

export function formatCustomerDateLine(clientName: string, issueDate: Date) {
  const customer = `CUSTOMER: ${clientName.toUpperCase()}`;
  const dateStr = `DATE:${issueDate.getMonth() + 1}/${issueDate.getDate()}/${issueDate.getFullYear()}`;
  const targetWidth = 120;
  const pad = Math.max(1, targetWidth - customer.length);
  return customer + " ".repeat(pad) + dateStr;
}

function sanitizeFilename(name: string) {
  return name.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
}

export function billingDownloadFilename(
  clientName: string,
  year: number,
  startMonth: number,
  endMonth: number,
  ext: "xlsx" = "xlsx"
) {
  const months = formatMonthsCoveredLabel(year, startMonth, endMonth)
    .replace(/\s+/g, "-")
    .toLowerCase();
  return `billing-${sanitizeFilename(clientName)}-${months}.${ext}`;
}

export function prepareBillingStatement(input: GenerateBillingInput): BillingStatementData {
  const { clientName, issueDate, startMonth, endMonth, rentals } = input;

  if (startMonth < 0 || startMonth > 11 || endMonth < startMonth || endMonth > 11) {
    throw new Error("Invalid month range");
  }

  const suggestion = getClientPaymentSuggestion(rentals);
  if (!suggestion || suggestion.monthlyPayable <= 0) {
    throw new Error("No active rented units to bill for this client");
  }

  const monthCount = endMonth - startMonth + 1;
  if (monthCount > MAX_BILLING_MONTHS) {
    throw new Error(`Maximum ${MAX_BILLING_MONTHS} months per billing statement`);
  }

  const representative =
    input.representativeName ?? process.env.BILLING_REPRESENTATIVE_NAME ?? "SUNDAY SETH A. ATUEL";

  const months: { label: string; amount: number }[] = [];
  let total = 0;

  for (let month = startMonth; month <= endMonth; month++) {
    const amount = suggestion.monthlyPayable;
    total += amount;
    months.push({
      label: `MONTH OF ${MONTH_NAMES_UPPER[month]}`,
      amount,
    });
  }

  const unitDescription = buildUnitDescription(rentals);

  return {
    clientName,
    customerLine: formatCustomerDateLine(clientName, issueDate),
    issueDateLabel: `${issueDate.getMonth() + 1}/${issueDate.getDate()}/${issueDate.getFullYear()}`,
    unitDescription: unitDescription || `${suggestion.unitCount} printer unit(s)`,
    representative,
    months,
    total,
    monthlyPayable: suggestion.monthlyPayable,
    unitCount: suggestion.unitCount,
  };
}
