import type { PaymentSchedule, RentalStatus } from "@prisma/client";

export const RENTAL_ANNUAL_START_YEAR = 2026;

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type MonthCell = {
  month: number;
  label: string;
  paid: number;
  expected: number | null;
  state: "empty" | "expected" | "paid" | "partial" | "paused" | "out";
};

/** True when the calendar month is after the current month (same year) or in a future year. */
export function isFutureMonth(year: number, month: number, now = new Date()): boolean {
  if (year > now.getFullYear()) return true;
  if (year < now.getFullYear()) return false;
  return month > now.getMonth();
}

/** True when the calendar month ended before the current month. */
export function isPastMonth(year: number, month: number, now = new Date()): boolean {
  if (year < now.getFullYear()) return true;
  if (year > now.getFullYear()) return false;
  return month < now.getMonth();
}

export type RentalAnnualRow = {
  id: string;
  clientId: string;
  clientName: string;
  printerLabel: string;
  status: RentalStatus;
  ratePerPeriod: number;
  months: MonthCell[];
  yearPaid: number;
  yearExpected: number;
};

export type ClientAnnualRow = {
  clientId: string;
  clientName: string;
  unitCount: number;
  rentalIds: string[];
  status: RentalStatus;
  months: MonthCell[];
  yearPaid: number;
  yearExpected: number;
};

type RentalLike = {
  id: string;
  status: RentalStatus;
  startDate: Date;
  endDate: Date | null;
  ratePerPeriod: number;
  paymentSchedule: PaymentSchedule;
  client: { id: string; name: string };
  printer: { brand: string | null; model: string | null; serialNumber: string | null } | null;
  payments: { amount: number; paidAt: Date }[];
};

export function rentalAnnualYearOptions(now = new Date()): number[] {
  const max = Math.max(RENTAL_ANNUAL_START_YEAR, now.getFullYear() + 1);
  const years: number[] = [];
  for (let y = RENTAL_ANNUAL_START_YEAR; y <= max; y++) years.push(y);
  return years;
}

export function defaultRentalAnnualYear(now = new Date()): number {
  return Math.max(RENTAL_ANNUAL_START_YEAR, now.getFullYear());
}

/** Auto-renew: active/paused rentals bill through end of selected calendar year. */
export function effectiveContractEnd(
  rental: { endDate: Date | null; status: RentalStatus; startDate: Date },
  year: number
): Date {
  if (rental.status === "COMPLETED" || rental.status === "CANCELLED") {
    if (rental.endDate) return rental.endDate;
    return new Date(year, 11, 31, 23, 59, 59, 999);
  }
  return new Date(year, 11, 31, 23, 59, 59, 999);
}

function monthRange(year: number, month: number) {
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 0, 23, 59, 59, 999),
  };
}

function isMonthInContract(
  rental: RentalLike,
  year: number,
  month: number
): boolean {
  const { start, end } = monthRange(year, month);
  const contractEnd = effectiveContractEnd(rental, year);
  if (end < rental.startDate) return false;
  if (start > contractEnd) return false;
  if (rental.status === "COMPLETED" || rental.status === "CANCELLED") {
    if (rental.endDate && start > rental.endDate) return false;
  }
  return true;
}

function isBillingMonth(schedule: PaymentSchedule, month: number): boolean {
  if (schedule === "MONTHLY") return true;
  if (schedule === "QUARTERLY") return month % 3 === 0;
  if (schedule === "ANNUAL") return month === 0;
  return true;
}

function paymentsInMonth(
  payments: { amount: number; paidAt: Date }[],
  year: number,
  month: number
): number {
  return payments
    .filter((p) => {
      const d = new Date(p.paidAt);
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .reduce((sum, p) => sum + p.amount, 0);
}

export function buildRentalAnnualRow(rental: RentalLike, year: number): RentalAnnualRow {
  const printerLabel = rental.printer
    ? [rental.printer.brand, rental.printer.model, rental.printer.serialNumber]
        .filter(Boolean)
        .join(" ")
    : "—";

  const months: MonthCell[] = MONTH_LABELS.map((label, month) => {
    const paid = paymentsInMonth(rental.payments, year, month);

    if (!isMonthInContract(rental, year, month)) {
      return { month, label, paid: 0, expected: null, state: "out" as const };
    }

    if (rental.status === "PAUSED") {
      return {
        month,
        label,
        paid,
        expected: isBillingMonth(rental.paymentSchedule, month)
          ? rental.ratePerPeriod
          : null,
        state: "paused" as const,
      };
    }

    const billsThisMonth = isBillingMonth(rental.paymentSchedule, month);
    const expected = billsThisMonth ? rental.ratePerPeriod : null;

    let state: MonthCell["state"] = "empty";
    if (paid > 0 && expected != null) {
      state = paid >= expected - 0.01 ? "paid" : "partial";
    } else if (paid > 0) {
      state = "paid";
    } else if (expected != null) {
      state = "expected";
    }

    return { month, label, paid, expected, state };
  });

  const yearPaid = months.reduce((s, m) => s + m.paid, 0);
  const yearExpected = months.reduce((s, m) => s + (m.expected ?? 0), 0);

  return {
    id: rental.id,
    clientId: rental.client.id,
    clientName: rental.client.name,
    printerLabel,
    status: rental.status,
    ratePerPeriod: rental.ratePerPeriod,
    months,
    yearPaid,
    yearExpected,
  };
}

const STATUS_PRIORITY: RentalStatus[] = ["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"];

function groupStatus(statuses: RentalStatus[]): RentalStatus {
  for (const status of STATUS_PRIORITY) {
    if (statuses.includes(status)) return status;
  }
  return statuses[0] ?? "ACTIVE";
}

function mergeMonthCells(cells: MonthCell[]): MonthCell {
  const { month, label } = cells[0];
  const inContract = cells.filter((c) => c.state !== "out");

  if (inContract.length === 0) {
    return { month, label, paid: 0, expected: null, state: "out" };
  }

  const paid = inContract.reduce((s, c) => s + c.paid, 0);
  const expectedSum = inContract.reduce((s, c) => s + (c.expected ?? 0), 0);
  const expected = expectedSum > 0 ? expectedSum : null;

  const billingPaused = inContract.filter(
    (c) => c.state === "paused" && c.expected != null
  );
  const allBillingPaused =
    billingPaused.length > 0 &&
    billingPaused.length === inContract.filter((c) => c.expected != null).length;

  if (paid > 0 && expected != null) {
    return {
      month,
      label,
      paid,
      expected,
      state: paid >= expected - 0.01 ? "paid" : "partial",
    };
  }
  if (paid > 0) {
    return { month, label, paid, expected, state: "paid" };
  }
  if (allBillingPaused && expected != null) {
    return { month, label, paid, expected, state: "paused" };
  }
  if (expected != null) {
    return { month, label, paid, expected, state: "expected" };
  }
  return { month, label, paid, expected, state: "empty" };
}

/** One row per client with monthly totals summed across all rental units. */
export function buildClientAnnualRows(rentals: RentalLike[], year: number): ClientAnnualRow[] {
  const byClient = new Map<string, RentalLike[]>();

  for (const rental of rentals) {
    const list = byClient.get(rental.client.id) ?? [];
    list.push(rental);
    byClient.set(rental.client.id, list);
  }

  const rows: ClientAnnualRow[] = [];

  for (const [, clientRentals] of byClient) {
    const unitRows = clientRentals.map((r) => buildRentalAnnualRow(r, year));
    const months = MONTH_LABELS.map((label, month) =>
      mergeMonthCells(unitRows.map((r) => r.months[month]))
    );
    const yearPaid = months.reduce((s, m) => s + m.paid, 0);
    const yearExpected = months.reduce((s, m) => s + (m.expected ?? 0), 0);

    rows.push({
      clientId: clientRentals[0].client.id,
      clientName: clientRentals[0].client.name,
      unitCount: clientRentals.length,
      rentalIds: clientRentals.map((r) => r.id),
      status: groupStatus(clientRentals.map((r) => r.status)),
      months,
      yearPaid,
      yearExpected,
    });
  }

  return rows.sort((a, b) => a.clientName.localeCompare(b.clientName));
}

export { MONTH_LABELS };
