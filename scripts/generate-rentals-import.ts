/**
 * Builds Data/rentals-import.csv from rentals.csv + printers-import.csv
 * Run: npx tsx scripts/generate-rentals-import.ts
 */
import fs from "fs";
import path from "path";
import Papa from "papaparse";

const DEFAULT_DUE = new Date(2026, 5, 5); // 2026-06-05

function parseMoney(raw: string): number {
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseUnits(raw: string): number {
  const n = parseInt(raw.replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parseDueDate(raw: string): Date {
  const text = raw.trim();
  if (!text) return DEFAULT_DUE;

  const mdy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    const year = mdy[3].length === 2 ? 2000 + parseInt(mdy[3], 10) : parseInt(mdy[3], 10);
    return new Date(year, parseInt(mdy[1], 10) - 1, parseInt(mdy[2], 10));
  }

  const months: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  const dmy = text.match(/^(\d{1,2})-([A-Za-z]{3})(?:-(\d{2,4}))?$/i);
  if (dmy) {
    const mon = months[dmy[2].toLowerCase().slice(0, 3)];
    if (mon === undefined) return DEFAULT_DUE;
    const year = dmy[3]
      ? dmy[3].length === 2
        ? 2000 + parseInt(dmy[3], 10)
        : parseInt(dmy[3], 10)
      : 2026;
    return new Date(year, mon, parseInt(dmy[1], 10));
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? DEFAULT_DUE : parsed;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addYears(d: Date, years: number): Date {
  const copy = new Date(d);
  copy.setFullYear(copy.getFullYear() + years);
  return copy;
}

type RentalRow = {
  client_name: string;
  units: number;
  payable_per_month: number;
  due_date: Date;
  particulars: string;
};

const rentalsPath = path.join(process.cwd(), "Data", "rentals.csv");
const printersPath = path.join(process.cwd(), "Data", "printers-import.csv");
const outPath = path.join(process.cwd(), "Data", "rentals-import.csv");

const rentalsRaw = fs.readFileSync(rentalsPath, "utf-8");
const rentalsParsed = Papa.parse<Record<string, string>>(rentalsRaw, {
  header: true,
  skipEmptyLines: true,
});

const clientRentals = new Map<string, RentalRow>();

for (const row of rentalsParsed.data) {
  const clientName = row["CLIENT NAME"]?.trim();
  if (!clientName) continue;

  const units = parseUnits(row["# UNITS"]?.trim() || "1");
  const payable = parseMoney(row["PAYABLE PER MONTH"]?.trim() || "0");
  const dueDate = parseDueDate(row["DUE DATE"]?.trim() || "");
  const particulars = row["PARTICULARS"]?.trim() || "";

  clientRentals.set(clientName, {
    client_name: clientName,
    units,
    payable_per_month: payable,
    due_date: dueDate,
    particulars,
  });
}

const printersRaw = fs.readFileSync(printersPath, "utf-8");
const printersParsed = Papa.parse<Record<string, string>>(printersRaw, {
  header: true,
  skipEmptyLines: true,
});

const output: Record<string, string>[] = [];

for (const printer of printersParsed.data) {
  const serial = printer.serial_number?.trim();
  const clientName = printer.client_name?.trim();
  if (!serial || !clientName) continue;

  const rental = clientRentals.get(clientName);
  if (!rental) {
    console.warn(`No rental row for client: ${clientName}`);
    continue;
  }

  const endDate = rental.due_date;
  const startDate = addYears(endDate, -1);
  const ratePerPeriod =
    rental.units > 0
      ? Math.round((rental.payable_per_month / rental.units) * 100) / 100
      : rental.payable_per_month;
  const totalContract = Math.round(ratePerPeriod * 12 * 100) / 100;

  output.push({
    client_name: clientName,
    serial_number: serial,
    start_date: formatDate(startDate),
    end_date: formatDate(endDate),
    rate_per_period: ratePerPeriod.toFixed(2),
    payment_schedule: "MONTHLY",
    total_contract: totalContract.toFixed(2),
    status: "ACTIVE",
    description: rental.particulars,
  });
}

const csv = Papa.unparse(output, {
  columns: [
    "client_name",
    "serial_number",
    "start_date",
    "end_date",
    "rate_per_period",
    "payment_schedule",
    "total_contract",
    "status",
    "description",
  ],
});

fs.writeFileSync(outPath, csv, "utf-8");
console.log(`Wrote ${output.length} rentals to ${outPath}`);
