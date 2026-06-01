import path from "path";
import ExcelJS from "exceljs";
import { getClientPaymentSuggestion } from "@/lib/rental-annual";
import type { PaymentSchedule, PrinterStatus, RentalStatus } from "@prisma/client";

const MONTH_NAMES_UPPER = [
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

/** Deployed with the app (committed under /templates — not gitignored like /Data). */
const TEMPLATE_PATH = path.join(process.cwd(), "templates", "billing.xlsx");

/** One statement block in the template (rows 2–19 and 22–39). */
const BLOCK_ROW_OFFSET = 20;
const COPIES_PER_PAGE = 2;
const PAGE_LAST_ROW = 39;

const ROW = {
  customer: 7,
  unit: 9,
  monthStart: 10,
  monthEnd: 15,
  total: 16,
  representative: 18,
} as const;

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

function formatCustomerDateLine(clientName: string, issueDate: Date) {
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
  endMonth: number
) {
  const months = formatMonthsCoveredLabel(year, startMonth, endMonth)
    .replace(/\s+/g, "-")
    .toLowerCase();
  return `billing-${sanitizeFilename(clientName)}-${months}.xlsx`;
}

function fillBillingBlock(
  sheet: ExcelJS.Worksheet,
  blockOffset: number,
  data: {
    customerLine: string;
    unitDescription: string;
    unitFallback: string;
    representative: string;
    startMonth: number;
    endMonth: number;
    monthlyPayable: number;
  }
) {
  const customerRow = ROW.customer + blockOffset;
  const unitRow = ROW.unit + blockOffset;
  const totalRow = ROW.total + blockOffset;
  const repRow = ROW.representative + blockOffset;

  sheet.getCell(`A${customerRow}`).value = data.customerLine;
  sheet.getCell(`A${unitRow}`).value = data.unitDescription || data.unitFallback;
  sheet.getCell(`C${unitRow}`).value = "UNLIMITED PRINTING SERVICES ";

  for (let row = ROW.monthStart; row <= ROW.monthEnd; row++) {
    const r = row + blockOffset;
    sheet.getCell(`C${r}`).value = null;
    sheet.getCell(`I${r}`).value = null;
    sheet.getCell(`J${r}`).value = null;
  }

  const monthCount = data.endMonth - data.startMonth + 1;
  let total = 0;

  for (let i = 0; i < monthCount; i++) {
    const month = data.startMonth + i;
    const row = ROW.monthStart + blockOffset + i;
    const amount = data.monthlyPayable;
    total += amount;
    sheet.getCell(`C${row}`).value = `MONTH OF ${MONTH_NAMES_UPPER[month]}`;
    sheet.getCell(`I${row}`).value = amount;
    sheet.getCell(`J${row}`).value = amount;
  }

  const firstMonthRow = ROW.monthStart + blockOffset;
  const lastMonthRow = ROW.monthStart + blockOffset + monthCount - 1;

  sheet.getCell(`C${totalRow}`).value = "TOTAL ";
  sheet.getCell(`I${totalRow}`).value = {
    formula: `SUM(I${firstMonthRow}:I${lastMonthRow})`,
    result: total,
  };
  sheet.getCell(`J${totalRow}`).value = {
    formula: `SUM(J${firstMonthRow}:J${lastMonthRow})`,
    result: total,
  };

  sheet.getCell(`A${repRow}`).value = data.representative;
}

export async function generateClientBillingExcel(input: GenerateBillingInput): Promise<Buffer> {
  const { clientName, issueDate, year, startMonth, endMonth, rentals } = input;
  const representative =
    input.representativeName ?? process.env.BILLING_REPRESENTATIVE_NAME ?? "SUNDAY SETH A. ATUEL";

  if (startMonth < 0 || startMonth > 11 || endMonth < startMonth || endMonth > 11) {
    throw new Error("Invalid month range");
  }

  const suggestion = getClientPaymentSuggestion(rentals);
  if (!suggestion || suggestion.monthlyPayable <= 0) {
    throw new Error("No active rented units to bill for this client");
  }

  const monthCount = endMonth - startMonth + 1;
  if (monthCount > ROW.monthEnd - ROW.monthStart + 1) {
    throw new Error("Maximum 6 months per billing statement");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Billing template sheet not found");

  // Keep one page = 2 duplicate statements (rows 1–39); remove extra stacked copies.
  if (sheet.rowCount > PAGE_LAST_ROW) {
    sheet.spliceRows(PAGE_LAST_ROW + 1, sheet.rowCount - PAGE_LAST_ROW);
  }

  sheet.name = formatMonthsCoveredLabel(year, startMonth, endMonth).slice(0, 31);

  const customerLine = formatCustomerDateLine(clientName, issueDate);
  const unitDescription = buildUnitDescription(rentals);
  const blockData = {
    customerLine,
    unitDescription,
    unitFallback: `${suggestion.unitCount} printer unit(s)`,
    representative,
    startMonth,
    endMonth,
    monthlyPayable: suggestion.monthlyPayable,
  };

  for (let copy = 0; copy < COPIES_PER_PAGE; copy++) {
    fillBillingBlock(sheet, copy * BLOCK_ROW_OFFSET, blockData);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
