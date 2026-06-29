import ExcelJS from "exceljs";
import { summarizePayments } from "@/lib/payments";
import {
  formatRepairCustomerLabel,
  formatRepairPrinterLabel,
  repairDisplayTitle,
} from "@/lib/repair-device";

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
  return `repair-billing-${safe}-${d}.xlsx`;
}

export function buildRepairBillingLine(repair: {
  id: string;
  receivedAt: Date;
  problem: string;
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
}): RepairBillingStatement {
  return {
    clientName: input.clientName,
    issueDate: input.issueDate,
    lines: input.repairs.map(buildRepairBillingLine),
  };
}

function formatDateCell(d: Date) {
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

export async function generateRepairBillingExcel(
  statement: RepairBillingStatement
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Repair billing", {
    views: [{ showGridLines: true }],
  });

  sheet.columns = [
    { width: 14 },
    { width: 28 },
    { width: 36 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
  ];

  const titleFont: Partial<ExcelJS.Font> = { bold: true, size: 14 };
  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8F0FE" },
  };

  sheet.mergeCells("A1:F1");
  sheet.getCell("A1").value = "JESEAN RENTALS";
  sheet.getCell("A1").font = titleFont;

  sheet.mergeCells("A2:F2");
  sheet.getCell("A2").value = "REPAIR BILLING STATEMENT";
  sheet.getCell("A2").font = { bold: true, size: 12 };

  sheet.getCell("A4").value = "Customer:";
  sheet.getCell("A4").font = { bold: true };
  sheet.mergeCells("B4:F4");
  sheet.getCell("B4").value = statement.clientName;

  sheet.getCell("A5").value = "Date issued:";
  sheet.getCell("A5").font = { bold: true };
  sheet.mergeCells("B5:F5");
  sheet.getCell("B5").value = formatDateCell(statement.issueDate);

  const headerRow = 7;
  const headers = ["Date received", "Device", "Problem / job", "Amount", "Paid", "Balance"];
  headers.forEach((label, i) => {
    const cell = sheet.getCell(headerRow, i + 1);
    cell.value = label;
    cell.font = { bold: true };
    cell.fill = headerFill;
    cell.border = { bottom: { style: "thin" } };
  });

  let row = headerRow + 1;
  let totalAmount = 0;
  let totalPaid = 0;
  let totalBalance = 0;

  for (const line of statement.lines) {
    sheet.getCell(row, 1).value = formatDateCell(line.receivedAt);
    sheet.getCell(row, 2).value = line.printerLabel;
    sheet.getCell(row, 3).value = line.problem;
    sheet.getCell(row, 4).value = line.totalAmount;
    sheet.getCell(row, 5).value = line.paid;
    sheet.getCell(row, 6).value = line.balance;
    for (let c = 4; c <= 6; c++) {
      sheet.getCell(row, c).numFmt = '"₱"#,##0.00';
    }
    totalAmount += line.totalAmount;
    totalPaid += line.paid;
    totalBalance += line.balance;
    row++;
  }

  sheet.getCell(row, 3).value = "TOTAL";
  sheet.getCell(row, 3).font = { bold: true };
  sheet.getCell(row, 4).value = totalAmount;
  sheet.getCell(row, 5).value = totalPaid;
  sheet.getCell(row, 6).value = totalBalance;
  for (let c = 3; c <= 6; c++) {
    const cell = sheet.getCell(row, c);
    cell.font = { bold: true };
    if (c >= 4) cell.numFmt = '"₱"#,##0.00';
    cell.border = { top: { style: "thin" } };
  }

  row += 2;
  sheet.mergeCells(`A${row}:F${row}`);
  sheet.getCell(`A${row}`).value =
    "Thank you for your business. Please settle any balance shown above.";
  sheet.getCell(`A${row}`).font = { italic: true, size: 10, color: { argb: "FF64748B" } };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function repairCustomerDisplayName(repair: {
  client?: { name: string } | null;
  customerName?: string | null;
}): string {
  return formatRepairCustomerLabel(repair);
}
