import {
  buildRentalAnnualRow,
  defaultRentalAnnualYear,
  type RentalAnnualRow,
} from "@/lib/rental-annual";
import type { ClientStatus, PaymentSchedule, RentalStatus } from "@prisma/client";

export type PortalRentalForBalance = {
  status: RentalStatus;
  startDate: Date;
  endDate: Date | null;
  ratePerPeriod: number;
  paymentSchedule: PaymentSchedule;
  payments: { amount: number; paidAt: Date }[];
  printer: {
    brand: string | null;
    model: string | null;
    serialNumber: string | null;
    price: number | null;
  } | null;
  pausePeriods: { pausedAt: Date; resumedAt: Date | null }[];
  client: { id: string; name: string; status: ClientStatus };
};

export type PortalRentalBalance = {
  label: "paid" | "overdue" | "running" | "paused" | "inactive";
  overdueBalance: number;
  overdueMonths: string[];
};

export function balanceFromAnnualRow(
  row: RentalAnnualRow,
  status: RentalStatus
): PortalRentalBalance {
  const overdueMonths: string[] = [];
  let overdueBalance = 0;

  for (const cell of row.months) {
    if (cell.state !== "expected") continue;
    const owed = Math.max(0, (cell.expected ?? 0) - cell.paid);
    if (owed < 0.01) continue;
    overdueBalance += owed;
    overdueMonths.push(cell.label);
  }

  if (status === "COMPLETED" || status === "CANCELLED") {
    return {
      label: overdueBalance > 0 ? "overdue" : "inactive",
      overdueBalance,
      overdueMonths,
    };
  }

  if (status === "PAUSED" && overdueBalance === 0) {
    const anyPaused = row.months.some((m) => m.state === "paused");
    if (anyPaused) {
      return { label: "paused", overdueBalance: 0, overdueMonths: [] };
    }
  }

  if (overdueBalance > 0) {
    return { label: "overdue", overdueBalance, overdueMonths };
  }

  const hasRunning = row.months.some((m) => m.state === "running");
  if (hasRunning || status === "ACTIVE") {
    return { label: "paid", overdueBalance: 0, overdueMonths: [] };
  }

  return { label: "paid", overdueBalance: 0, overdueMonths: [] };
}

function toBalanceRentalLike(rental: PortalRentalForBalance) {
  return {
    id: "",
    status: rental.status,
    startDate: rental.startDate,
    endDate: rental.endDate,
    ratePerPeriod: rental.ratePerPeriod,
    paymentSchedule: rental.paymentSchedule,
    client: rental.client,
    printer: rental.printer,
    pausePeriods: rental.pausePeriods,
    payments: rental.payments,
  };
}

export function getPortalRentalBalance(
  rental: PortalRentalForBalance,
  year = defaultRentalAnnualYear()
): PortalRentalBalance {
  const row = buildRentalAnnualRow(toBalanceRentalLike(rental), year);
  return balanceFromAnnualRow(row, rental.status);
}

export function getClientRentalOverdueBalance(
  rentals: PortalRentalForBalance[],
  year = defaultRentalAnnualYear()
): number {
  return rentals
    .filter((r) => r.status === "ACTIVE" || r.status === "PAUSED")
    .reduce((sum, r) => sum + getPortalRentalBalance(r, year).overdueBalance, 0);
}
