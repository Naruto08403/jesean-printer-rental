import type { ClientStatus, PaymentSchedule, PrinterStatus, RentalStatus } from "@prisma/client";

export const RENTAL_ANNUAL_START_YEAR = 2026;

/** Default VAT withheld on rental payments (net = gross − VAT). */
export const DEFAULT_RENTAL_VAT_PERCENT = 5;

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
  reference?: string | null;
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
    | {
        brand: string | null;
        model: string | null;
        serialNumber: string | null;
        price?: number | null;
        status?: PrinterStatus;
      }
    | null;
  pausePeriods?: { pausedAt: Date; resumedAt: Date | null }[];
  payments: RentalPaymentLike[];
};

export type RentalPaymentLike = {
  amount: number;
  paidAt: Date;
  billingYear?: number | null;
  billingMonth?: number | null;
  reference?: string | null;
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

/** Any recorded payment for the month. */
export function monthHasPayment(paid: number): boolean {
  return paid > 0.001;
}

export function isMonthFullyPaid(paid: number, expected: number): boolean {
  return paid >= expected - 0.01;
}

/** Any payment recorded for the month — no further balance due (net after VAT is normal). */
export function isMonthSettled(paid: number): boolean {
  return monthHasPayment(paid);
}

/** Portal / UI: month still owes when billable and no payment recorded yet. */
export function isBillingMonthDue(cell: Pick<MonthCell, "state" | "paid">): boolean {
  return cell.state === "expected" && !isMonthSettled(cell.paid);
}

/** Portal / UI: month has a recorded payment (including net below gross contract). */
export function isBillingMonthSettled(cell: Pick<MonthCell, "state" | "paid">): boolean {
  return isMonthSettled(cell.paid) || cell.state === "paid" || cell.state === "partial";
}

/** @deprecated Use isMonthSettled — kept for callers comparing to gross expected. */
export function isMonthPartiallyPaid(paid: number, expected: number | null): boolean {
  return expected != null && monthHasPayment(paid) && !isMonthFullyPaid(paid, expected);
}

/** Net amount after withholding VAT from gross monthly payable. */
export function netPayableAfterVat(grossPayable: number, vatPercent: number): number {
  const pct = Math.min(100, Math.max(0, vatPercent));
  return Math.round(grossPayable * (1 - pct / 100) * 100) / 100;
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

  if (monthHasPayment(paid)) return "paid";
  if (!isMonthlyPaymentDue(rental.startDate, year, month, now)) return "running";
  return "expected";
}

export function isActiveRentalUnit(rental: { status: RentalStatus }): boolean {
  return rental.status === "ACTIVE" || rental.status === "PAUSED";
}

/** Active rental with printer still marked on rent (matches payment/billing modals). */
export function isBillableRentalUnit(rental: RentalRateLike): boolean {
  if (!isActiveRentalUnit(rental)) return false;
  if (rental.printer?.status && rental.printer.status !== "RENTED") return false;
  return true;
}

function contributesToClientBilling(rental: RentalLike): boolean {
  return isBillableRentalUnit(rental);
}

function isMonthInContract(
  rental: RentalBillingLike,
  year: number,
  month: number,
  now = new Date()
): boolean {
  const { start, end } = monthRange(year, month);
  const contractEnd = effectiveContractEnd(rental, year);
  if (end < rental.startDate) return false;
  if (start > contractEnd) return false;
  if (rental.status === "COMPLETED" || rental.status === "CANCELLED") {
    return false;
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

export function paymentAppliesToBillingMonth(
  payment: RentalPaymentLike,
  year: number,
  month: number
): boolean {
  if (payment.billingYear != null && payment.billingMonth != null) {
    return payment.billingYear === year && payment.billingMonth === month;
  }
  const d = new Date(payment.paidAt);
  return d.getFullYear() === year && d.getMonth() === month;
}

export function paymentsInMonth(
  payments: RentalPaymentLike[],
  year: number,
  month: number
): number {
  return payments
    .filter((p) => paymentAppliesToBillingMonth(p, year, month))
    .reduce((sum, p) => sum + p.amount, 0);
}
export function paymentReferenceInMonth(
  payments: RentalPaymentLike[],
  year: number,
  month: number
): string | null {
  // console.log("Looking for:", year, month);

  const payment = payments.find((p) => {
    // console.log(
    //   p.billingYear,
    //   p.billingMonth,
    //   "==>",
    //   p.billingYear === year && p.billingMonth === month
    // );

    return paymentAppliesToBillingMonth(p, year, month);
  });

  // console.log("Matched payment:", payment);

  return payment?.reference ?? null;
}
/** Months in range that are billable and have no payment yet (admin may record early). */
export function unpaidBillableMonths(
  rental: RentalBillingLike,
  year: number,
  startMonth: number,
  endMonth: number
): number[] {
  if (rental.status === "COMPLETED" || rental.status === "CANCELLED") return [];
  const months: number[] = [];
  for (let month = startMonth; month <= endMonth; month++) {
    if (!isMonthInContract(rental, year, month)) continue;
    if (!isBillingMonth(rental.paymentSchedule, month)) continue;
    const paid = paymentsInMonth(rental.payments, year, month);
    if (monthHasPayment(paid)) continue;
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
    // console.log("Payments:", rental.payments);
    
    const reference = paymentReferenceInMonth(
      rental.payments,
      year,
      month
    );
    // console.log("Reference:", reference);

    if (rental.status === "COMPLETED" || rental.status === "CANCELLED") {
      if (monthHasPayment(paid)) {
        return { month, label, paid,reference, expected: null, state: "paid" as const };
      }
      return { month, label, paid: 0,reference, expected: null, state: "out" as const };
    }

    if (!isMonthInContract(rental, year, month, now)) {
      return { month, label, paid: 0,reference, expected: null, state: "out" as const };
    }

    if (rental.status === "PAUSED" || isMonthPausedByHistory(rental, year, month)) {
      return {
        month,
        label,
        paid,
        reference,
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

    return { month, label, paid,reference, expected, state, };
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

function mergeClientMonthCells(allCells: MonthCell[], billingCells: MonthCell[]): MonthCell {
  const { month, label } = allCells[0];
  const paid = allCells.reduce((s, c) => s + c.paid, 0);
  const reference = allCells.find((c) => c.reference)?.reference ?? null;
  const inContract = billingCells.filter((c) => c.state !== "out");

  if (inContract.length === 0) {
    if (monthHasPayment(paid)) {
      return { month, label, paid,reference, expected: null, state: "paid" };
    }
    return { month, label, paid: 0,reference, expected: null, state: "out" };
  }

  const dueAmount = inContract
    .filter((c) => c.state === "expected")
    .reduce((s, c) => s + (c.expected ?? 0), 0);
  const billingTotal = inContract
    .filter(
      (c) =>
        c.expected != null &&
        c.state !== "running" &&
        c.state !== "out" &&
        c.state !== "empty"
    )
    .reduce((s, c) => s + (c.expected ?? 0), 0);
  const expected = dueAmount > 0 ? dueAmount : billingTotal > 0 ? billingTotal : null;

  const billingPaused = inContract.filter(
    (c) => c.state === "paused" && c.expected != null
  );
  const allBillingPaused =
    billingPaused.length > 0 &&
    billingPaused.length === inContract.filter((c) => c.expected != null).length;

  if (expected != null && monthHasPayment(paid)) {
    return { month, label, paid,reference, expected, state: "paid" };
  }
  if (inContract.some((c) => c.state === "expected")) {
    return { month, label, paid,reference, expected, state: "expected" };
  }
  if (inContract.some((c) => c.state === "paid" || c.state === "partial")) {
    return { month, label, paid,reference, expected, state: "paid" };
  }
  if (allBillingPaused && expected != null) {
    return { month, label, paid,reference, expected, state: "paused" };
  }
  if (inContract.some((c) => c.state === "running")) {
    return { month, label, paid, expected, state: "running" };
  }
  if (expected != null) {
    return { month, label, paid,reference, expected, state: "expected" };
  }
  return { month, label, paid,reference, expected, state: "empty" };
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
    const billableRentals = clientRentals.filter(isBillableRentalUnit);
    const billingRentals = clientRentals.filter(contributesToClientBilling);
    const unitRows = clientRentals.map((r) => buildRentalAnnualRow(r, year, now));
    const billingUnitRows = billingRentals.map((r) => buildRentalAnnualRow(r, year, now));
    let months = MONTH_LABELS.map((label, month) =>
      mergeClientMonthCells(
        unitRows.map((r) => r.months[month]),
        billingUnitRows.map((r) => r.months[month])
      )
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
      unitCount: billableRentals.length,
      rentalIds: billableRentals.map((r) => r.id),
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
  const activeUnits = rentals.filter(isBillableRentalUnit);
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
