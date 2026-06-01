import type { ClientStatus, PaymentSchedule, PrinterStatus, RentalStatus } from "@prisma/client";

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
  state: "empty" | "expected" | "paid" | "partial" | "paused" | "stopped" | "out" | "running";
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
  status: RentalStatus | ClientStatus;
  clientStatus: ClientStatus;
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
  client: { id: string; name: string; status: ClientStatus };
  printer:
    | { brand: string | null; model: string | null; serialNumber: string | null; price?: number | null }
    | null;
  pausePeriods?: { pausedAt: Date; resumedAt: Date | null }[];
  payments: { amount: number; paidAt: Date }[];
};

export type RentalBillingLike = Pick<
  RentalLike,
  "id" | "status" | "startDate" | "endDate" | "ratePerPeriod" | "paymentSchedule" | "payments"
> & {
  printer?: RentalLike["printer"];
};

function payableForRental(rental: { ratePerPeriod: number; printer?: { price?: number | null } | null }) {
  return rental.printer?.price ?? rental.ratePerPeriod;
}

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

/** Monthly due date: rental start day in the start month, otherwise last day of the month. */
export function monthlyPaymentDueDate(
  startDate: Date,
  year: number,
  month: number
): Date {
  const { end: monthEnd } = monthRange(year, month);
  const startedThisMonth =
    startDate.getFullYear() === year && startDate.getMonth() === month;
  if (startedThisMonth) {
    return new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      23,
      59,
      59,
      999
    );
  }
  return monthEnd;
}

export function isMonthlyPaymentDue(
  startDate: Date,
  year: number,
  month: number,
  now = new Date()
): boolean {
  return now.getTime() >= monthlyPaymentDueDate(startDate, year, month).getTime();
}

function resolveBillingMonthState(
  rental: RentalBillingLike,
  year: number,
  month: number,
  paid: number,
  payable: number,
  now = new Date()
): MonthCell["state"] {
  if (!isBillingMonth(rental.paymentSchedule, month)) return "empty";

  if (paid >= payable - 0.01) return "paid";
  if (!isMonthlyPaymentDue(rental.startDate, year, month, now)) return "running";
  return "expected";
}

function isMonthInContract(
  rental: RentalBillingLike,
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

function isMonthPausedByHistory(rental: RentalLike, year: number, month: number): boolean {
  const periods = rental.pausePeriods ?? [];
  if (periods.length === 0) return false;
  const { start, end } = monthRange(year, month);
  return periods.some((period) => {
    const pausedStart = new Date(period.pausedAt);
    const pausedEnd = period.resumedAt ? new Date(period.resumedAt) : new Date(8640000000000000);
    return pausedStart <= end && pausedEnd >= start;
  });
}

export function paymentsInMonth(
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

/** Months in range that are billable and not yet fully paid for a rental. */
export function unpaidBillableMonths(
  rental: RentalBillingLike,
  year: number,
  startMonth: number,
  endMonth: number,
  fullPaymentAmount?: number
): number[] {
  const targetAmount = fullPaymentAmount ?? payableForRental(rental);
  const months: number[] = [];
  for (let month = startMonth; month <= endMonth; month++) {
    if (!isMonthInContract(rental, year, month)) continue;
    if (!isBillingMonth(rental.paymentSchedule, month)) continue;
    if (!isMonthlyPaymentDue(rental.startDate, year, month)) continue;
    const paid = paymentsInMonth(rental.payments, year, month);
    if (paid >= targetAmount - 0.01) continue;
    months.push(month);
  }
  return months;
}

export function buildRentalAnnualRow(
  rental: RentalLike,
  year: number,
  now = new Date()
): RentalAnnualRow {
  const payable = payableForRental(rental);
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

    if (rental.status === "PAUSED" || isMonthPausedByHistory(rental, year, month)) {
      return {
        month,
        label,
        paid,
        expected: isBillingMonth(rental.paymentSchedule, month)
          ? payable
          : null,
        state: "paused" as const,
      };
    }

    const billsThisMonth = isBillingMonth(rental.paymentSchedule, month);
    const expected = billsThisMonth ? payable : null;
    const state =
      expected != null
        ? resolveBillingMonthState(rental, year, month, paid, payable, now)
        : "empty";

    return { month, label, paid, expected, state };
  });

  const yearPaid = months.reduce((s, m) => s + m.paid, 0);
  const yearExpected = months.reduce(
    (s, m) =>
      s +
      (m.expected != null && m.state !== "running" && m.state !== "out" && m.state !== "empty"
        ? m.expected
        : 0),
    0
  );

  return {
    id: rental.id,
    clientId: rental.client.id,
    clientName: rental.client.name,
    printerLabel,
    status: rental.status,
    ratePerPeriod: payable,
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

  if (expected != null && paid >= expected - 0.01) {
    return { month, label, paid, expected, state: "paid" };
  }
  if (inContract.some((c) => c.state === "expected")) {
    return { month, label, paid, expected, state: "expected" };
  }
  if (paid > 0 && expected != null) {
    return { month, label, paid, expected, state: "expected" };
  }
  if (paid > 0) {
    return { month, label, paid, expected, state: "paid" };
  }
  if (allBillingPaused && expected != null) {
    return { month, label, paid, expected, state: "paused" };
  }
  if (inContract.some((c) => c.state === "running")) {
    return { month, label, paid, expected, state: "running" };
  }
  if (expected != null) {
    return { month, label, paid, expected, state: "expected" };
  }
  return { month, label, paid, expected, state: "empty" };
}

function applyClientStoppedMonths(months: MonthCell[]): MonthCell[] {
  return months.map((cell) => {
    if (cell.state === "out" || cell.paid > 0) return cell;
    if (
      cell.expected != null ||
      cell.state === "expected" ||
      cell.state === "paused" ||
      cell.state === "running"
    ) {
      return { ...cell, state: "stopped" as const };
    }
    return cell;
  });
}

/** One row per client with monthly totals summed across all rental units. */
export function buildClientAnnualRows(
  rentals: RentalLike[],
  year: number,
  now = new Date()
): ClientAnnualRow[] {
  const byClient = new Map<string, RentalLike[]>();

  for (const rental of rentals) {
    const list = byClient.get(rental.client.id) ?? [];
    list.push(rental);
    byClient.set(rental.client.id, list);
  }

  const rows: ClientAnnualRow[] = [];

  for (const [, clientRentals] of byClient) {
    const clientStatus = clientRentals[0].client.status;
    const unitRows = clientRentals.map((r) => buildRentalAnnualRow(r, year, now));
    let months = MONTH_LABELS.map((label, month) =>
      mergeMonthCells(unitRows.map((r) => r.months[month]))
    );
    if (clientStatus === "STOPPED") {
      months = applyClientStoppedMonths(months);
    }
    const yearPaid = months.reduce((s, m) => s + m.paid, 0);
    const yearExpected = months.reduce(
      (s, m) =>
        s +
        (m.expected != null &&
        m.state !== "running" &&
        m.state !== "out" &&
        m.state !== "empty"
          ? m.expected
          : 0),
      0
    );

    rows.push({
      clientId: clientRentals[0].client.id,
      clientName: clientRentals[0].client.name,
      unitCount: clientRentals.length,
      rentalIds: clientRentals.map((r) => r.id),
      status:
        clientStatus === "STOPPED"
          ? "STOPPED"
          : groupStatus(clientRentals.map((r) => r.status)),
      clientStatus,
      months,
      yearPaid,
      yearExpected,
    });
  }

  return rows.sort((a, b) => a.clientName.localeCompare(b.clientName));
}

export { MONTH_LABELS };

type RentalRateLike = {
  status: RentalStatus;
  ratePerPeriod: number;
  paymentSchedule: PaymentSchedule;
  printer?: { price?: number | null; status?: PrinterStatus } | null;
};

/** Client-level monthly payable and per-unit amount for payment forms. */
export function getClientPaymentSuggestion(rentals: RentalRateLike[]): {
  monthlyPayable: number;
  suggestedAmount: number;
  unitCount: number;
} | null {
  const activeUnits = rentals.filter((r) => {
    if (r.status !== "ACTIVE") return false;
    if (r.printer && r.printer.status && r.printer.status !== "RENTED") return false;
    return true;
  });
  if (activeUnits.length === 0) return null;

  const monthlyRentals = activeUnits.filter((r) => r.paymentSchedule === "MONTHLY");
  const billed = monthlyRentals.length > 0 ? monthlyRentals : activeUnits;
  const monthlyPayable = billed.reduce((sum, r) => sum + payableForRental(r), 0);
  const unitCount = activeUnits.length;
  const rates = activeUnits.map((r) => payableForRental(r));
  const allSame = rates.every((rate) => Math.abs(rate - rates[0]) < 0.01);

  const suggestedAmount = allSame
    ? rates[0]
    : Math.round((monthlyPayable / unitCount) * 100) / 100;

  return { monthlyPayable, suggestedAmount, unitCount };
}
