import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  buildClientAnnualRows,
  buildRentalAnnualRow,
  defaultRentalAnnualYear,
  isBillingMonthDue,
  monthHasPayment,
  RENTAL_ANNUAL_START_YEAR,
  type ClientAnnualRow,
  type RentalAnnualRow,
} from "@/lib/rental-annual";
import { summarizePayments } from "@/lib/payments";
import { repairDisplayTitle } from "@/lib/repair-device";
import type {
  CctvInstallation,
  Client,
  Payment,
  Printer,
  Rental,
  RentalPausePeriod,
  Repair,
  Sale,
} from "@prisma/client";

export type PortalNotification = {
  id: string;
  type: "rental_due" | "repair_due" | "purchase_due" | "cctv_due" | "job_update";
  severity: "urgent" | "warning" | "info";
  title: string;
  message: string;
  href: string;
  amount?: number;
};

type RentalWithRelations = Rental & {
  payments: Payment[];
  printer: Printer | null;
  pausePeriods: RentalPausePeriod[];
  client: Client;
};

type RepairWithRelations = Repair & {
  payments: Payment[];
  printer: Printer | null;
};

type SaleWithRelations = Sale & { payments: Payment[] };
type CctvWithRelations = CctvInstallation & { payments: Payment[] };

export type PortalClientData = {
  client: Client;
  rentals: RentalWithRelations[];
  repairs: RepairWithRelations[];
  sales: SaleWithRelations[];
  cctvJobs: CctvWithRelations[];
  notifications: PortalNotification[];
  stats: {
    activeRentals: number;
    totalDue: number;
    openJobs: number;
  };
};

function toRentalLike(rental: RentalWithRelations) {
  return {
    id: rental.id,
    status: rental.status,
    startDate: rental.startDate,
    endDate: rental.endDate,
    ratePerPeriod: rental.ratePerPeriod,
    paymentSchedule: rental.paymentSchedule,
    client: {
      id: rental.client.id,
      name: rental.client.name,
      status: rental.client.status,
    },
    printer: rental.printer
      ? {
          brand: rental.printer.brand,
          model: rental.printer.model,
          serialNumber: rental.printer.serialNumber,
          price: rental.printer.price,
          status: rental.printer.status,
        }
      : null,
    pausePeriods: rental.pausePeriods.map((p) => ({
      pausedAt: p.pausedAt,
      resumedAt: p.resumedAt,
    })),
    payments: rental.payments.map((p) => ({
      amount: p.amount,
      paidAt: p.paidAt,
      billingYear: p.billingYear,
      billingMonth: p.billingMonth,
    })),
  };
}

function overdueFromAnnualRow(
  row: RentalAnnualRow,
  year: number,
  href: string,
  printerLabel: string
): PortalNotification[] {
  const items: PortalNotification[] = [];
  for (const cell of row.months) {
    if (!isBillingMonthDue(cell)) continue;
    if (monthHasPayment(cell.paid)) continue;
    const owed = cell.expected ?? 0;
    if (owed < 0.01) continue;
    items.push({
      id: `rental-${row.id}-${year}-${cell.month}`,
      type: "rental_due",
      severity: "urgent",
      title: "Rental payment due",
      message: `${printerLabel} — ${cell.label} ${year}`,
      href,
      amount: owed,
    });
  }
  return items;
}

function serviceDueNotification(
  type: "repair_due" | "purchase_due" | "cctv_due",
  id: string,
  title: string,
  total: number,
  payments: Payment[],
  href: string,
  open: boolean
): PortalNotification | null {
  const summary = summarizePayments(total, payments);
  if (summary.isFullyPaid) return null;
  return {
    id: `${type}-${id}`,
    type,
    severity: open ? "warning" : "info",
    title:
      type === "repair_due"
        ? "Repair balance due"
        : type === "purchase_due"
          ? "Purchase balance due"
          : "CCTV balance due",
    message: title,
    href,
    amount: summary.balance,
  };
}

function jobUpdateNotification(
  id: string,
  kind: "repair" | "cctv",
  title: string,
  status: string,
  href: string
): PortalNotification | null {
  if (status !== "PENDING" && status !== "IN_PROGRESS") return null;
  return {
    id: `job-${kind}-${id}`,
    type: "job_update",
    severity: "info",
    title: kind === "repair" ? "Repair in progress" : "CCTV job in progress",
    message: `${title} — ${status.replace("_", " ").toLowerCase()}`,
    href,
  };
}

export function buildPortalNotifications(data: {
  client: Client;
  rentals: RentalWithRelations[];
  repairs: RepairWithRelations[];
  sales: SaleWithRelations[];
  cctvJobs: CctvWithRelations[];
}): PortalNotification[] {
  const notifications: PortalNotification[] = [];
  const currentYear = defaultRentalAnnualYear();
  const rentalLikes = data.rentals.map(toRentalLike);

  for (const rental of data.rentals) {
    const like = toRentalLike(rental);
    const printerLabel = like.printer
      ? [like.printer.brand, like.printer.model].filter(Boolean).join(" ") || "Printer"
      : "Printer rental";
    const href = `/portal/rentals/${rental.id}`;

    if (rental.status === "ACTIVE" || rental.status === "PAUSED") {
      for (let year = RENTAL_ANNUAL_START_YEAR; year <= currentYear; year++) {
        const row = buildRentalAnnualRow(like, year);
        notifications.push(...overdueFromAnnualRow(row, year, href, printerLabel));
      }
    }
  }

  const clientRows = buildClientAnnualRows(rentalLikes, currentYear);
  const clientRow = clientRows.find((r) => r.clientId === data.client.id);
  if (clientRow && data.client.status === "STOPPED") {
    notifications.push({
      id: "client-stopped",
      type: "job_update",
      severity: "info",
      title: "Account on hold",
      message: "Your account is marked stopped — contact us to resume billing.",
      href: "/portal",
    });
  }

  for (const repair of data.repairs) {
    const due = serviceDueNotification(
      "repair_due",
      repair.id,
      repairDisplayTitle(repair),
      repair.isChargeWaived ? 0 : repair.totalAmount,
      repair.payments,
      "/portal/services#repairs",
      !repair.isChargeWaived &&
        repair.totalAmount > 0 &&
        repair.status !== "COMPLETED" &&
        repair.status !== "CANCELLED"
    );
    if (due) notifications.push(due);

    const job = jobUpdateNotification(
      repair.id,
      "repair",
      repairDisplayTitle(repair),
      repair.status,
      "/portal/services#repairs"
    );
    if (job) notifications.push(job);
  }

  for (const sale of data.sales) {
    const due = serviceDueNotification(
      "purchase_due",
      sale.id,
      sale.items,
      sale.totalAmount,
      sale.payments,
      "/portal/services#purchases",
      sale.status !== "COMPLETED" && sale.status !== "CANCELLED"
    );
    if (due) notifications.push(due);
  }

  // for (const job of data.cctvJobs) {
  //   const label = job.siteAddress ?? job.description ?? "CCTV installation";
  //   const due = serviceDueNotification(
  //     "cctv_due",
  //     job.id,
  //     label,
  //     job.totalAmount,
  //     job.payments,
  //     "/portal/services#cctv",
  //     job.status !== "COMPLETED" && job.status !== "CANCELLED"
  //   );
  //   if (due) notifications.push(due);

  //   const update = jobUpdateNotification(
  //     job.id,
  //     "cctv",
  //     label,
  //     job.status,
  //     "/portal/services#cctv"
  //   );
  //   if (update) notifications.push(update);
  // }

  const severityOrder = { urgent: 0, warning: 1, info: 2 };
  return notifications.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );
}

export function computePortalStats(data: {
  client: Client;
  rentals: RentalWithRelations[];
  repairs: RepairWithRelations[];
  sales: SaleWithRelations[];
  // cctvJobs: CctvWithRelations[];
  notifications: PortalNotification[];
}) {
  const totalDue = data.notifications
    .filter((n) => n.amount != null && n.type !== "job_update")
    .reduce((sum, n) => sum + (n.amount ?? 0), 0);

  const openJobs =
    data.repairs.filter((r) => r.status === "PENDING" || r.status === "IN_PROGRESS").length;
    // data.cctvJobs.filter((j) => j.status === "PENDING" || j.status === "IN_PROGRESS").length;

  return {
    activeRentals: data.rentals.filter(
      (r) => r.status === "ACTIVE" || r.status === "PAUSED"
    ).length,
    totalDue,
    openJobs,
  };
}

export const getPortalClientData = cache(async (clientId: string): Promise<PortalClientData | null> => {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      rentals: {
        orderBy: { startDate: "desc" },
        include: {
          payments: { orderBy: { paidAt: "desc" } },
          printer: true,
          pausePeriods: true,
          client: true,
        },
      },
      repairs: {
        orderBy: { createdAt: "desc" },
        include: { payments: true, printer: true },
      },
      sales: {
        orderBy: { createdAt: "desc" },
        include: { payments: true },
      },
      // cctvJobs: {
      //   orderBy: { createdAt: "desc" },
      //   include: { payments: true },
      // },
    },
  });

  if (!client) return null;

  const { rentals, repairs, sales, ...clientRecord } = client;
  const notifications = buildPortalNotifications({
    client: clientRecord,
    rentals,
    repairs,
    sales,
   
  });
  const stats = computePortalStats({
    client: clientRecord,
    rentals,
    repairs,
    sales,

    notifications,
  });

  return {
    client: clientRecord,
    rentals,
    repairs,
    sales,
    notifications,
    stats,
  };
});

export function printerLabel(
  printer: { brand?: string | null; model?: string | null } | null | undefined,
  fallback = "Printer rental"
) {
  if (!printer) return fallback;
  const name = [printer.brand, printer.model].filter(Boolean).join(" ");
  return name || fallback;
}

export function rentalToAnnualRow(rental: RentalWithRelations, year?: number) {
  return buildRentalAnnualRow(toRentalLike(rental), year ?? defaultRentalAnnualYear());
}

export function clientAnnualBillingRow(
  rentals: RentalWithRelations[],
  year = defaultRentalAnnualYear()
): ClientAnnualRow | null {
  if (rentals.length === 0) return null;
  const rows = buildClientAnnualRows(rentals.map(toRentalLike), year);
  return rows.find((r) => r.clientId === rentals[0].client.id) ?? rows[0] ?? null;
}

export { toRentalLike };
