"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, auth } from "@/lib/auth";
import { logPrinterAudit } from "@/lib/audit";
import { logRentalAudit, rentalStatusAuditMessage } from "@/lib/rental-audit";
import {
  formatPausePeriodRange,
  pausePeriodDatesFromMonths,
} from "@/lib/rental-pause";
import type { PaymentSchedule, RentalStatus } from "@prisma/client";
import Papa from "papaparse";

export async function createRental(formData: FormData) {
  await requireAdmin();
  const session = await auth();
  const clientId = String(formData.get("clientId"));
  const printerId = String(formData.get("printerId") || "") || null;
  const startDate = new Date(String(formData.get("startDate")));
  const endDate = formData.get("endDate")
    ? new Date(String(formData.get("endDate")))
    : null;
  const ratePerPeriod = Number(formData.get("ratePerPeriod"));
  const totalContract = formData.get("totalContract")
    ? Number(formData.get("totalContract"))
    : null;
  const paymentSchedule = formData.get("paymentSchedule") as PaymentSchedule;
  const description = String(formData.get("description") || "").trim() || null;

  const rental = await prisma.rental.create({
    data: {
      clientId,
      printerId,
      startDate,
      endDate,
      ratePerPeriod,
      totalContract,
      paymentSchedule,
      description,
    },
  });

  await logRentalAudit(rental.id, "CREATED", "Rental created", {
    userEmail: session?.user?.email,
    metadata: { clientId, printerId, status: "ACTIVE" },
  });

  if (printerId) {
    await prisma.printer.update({
      where: { id: printerId },
      data: { status: "RENTED" },
    });
    await logPrinterAudit(printerId, "RENTAL_LINKED", "Rental started for client", {
      userEmail: session?.user?.email,
      metadata: { rentalId: rental.id, clientId },
    });
  }

  revalidatePath("/dashboard/rentals");
  revalidatePath("/dashboard/printers");
}

export async function importRentalsFromCsv(csvText: string) {
  await requireAdmin();
  const session = await auth();
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message ?? "Invalid CSV");
  }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of parsed.data) {
    const clientName = row.client_name?.trim();
    const serialNumber = row.serial_number?.trim();
    if (!clientName || !serialNumber) continue;

    const client = await prisma.client.findFirst({
      where: { name: clientName },
    });
    if (!client) {
      errors.push(`Client not found: ${clientName}`);
      skipped++;
      continue;
    }

    const printer = await prisma.printer.findUnique({
      where: { serialNumber },
    });
    if (!printer) {
      errors.push(`Printer not found: ${serialNumber}`);
      skipped++;
      continue;
    }

    const existing = await prisma.rental.findFirst({
      where: { printerId: printer.id, status: { in: ["ACTIVE", "PAUSED"] } },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const startDate = new Date(row.start_date?.trim() || "");
    const endDate = row.end_date?.trim() ? new Date(row.end_date.trim()) : null;
    const ratePerPeriod = parseFloat(row.rate_per_period?.trim() || "0");
    const totalContract = row.total_contract?.trim()
      ? parseFloat(row.total_contract)
      : null;
    const schedule = (row.payment_schedule?.trim().toUpperCase() ||
      "MONTHLY") as PaymentSchedule;
    const validSchedules: PaymentSchedule[] = ["MONTHLY", "QUARTERLY", "ANNUAL"];
    const paymentSchedule = validSchedules.includes(schedule) ? schedule : "MONTHLY";
    const status = (row.status?.trim().toUpperCase() || "ACTIVE") as RentalStatus;
    const validStatuses: RentalStatus[] = ["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"];
    const rentalStatus = validStatuses.includes(status) ? status : "ACTIVE";

    if (!ratePerPeriod || Number.isNaN(startDate.getTime())) {
      errors.push(`Invalid row for ${serialNumber}`);
      skipped++;
      continue;
    }

    const rental = await prisma.rental.create({
      data: {
        clientId: client.id,
        printerId: printer.id,
        startDate,
        endDate,
        ratePerPeriod,
        totalContract,
        paymentSchedule,
        status: rentalStatus,
        description: row.description?.trim() || null,
      },
    });
    if (rentalStatus === "PAUSED") {
      await prisma.rentalPausePeriod.create({
        data: {
          rentalId: rental.id,
          pausedAt: rental.startDate,
        },
      });
    }

    await logRentalAudit(rental.id, "CREATED", "Rental imported from CSV", {
      userEmail: session?.user?.email,
      metadata: { serialNumber, status: rentalStatus },
    });

    if (rentalStatus === "ACTIVE" || rentalStatus === "PAUSED") {
      await prisma.printer.update({
        where: { id: printer.id },
        data: { status: "RENTED" },
      });
    }
    await logPrinterAudit(printer.id, "RENTAL_LINKED", "Rental imported from CSV", {
      userEmail: session?.user?.email ?? undefined,
      metadata: { rentalId: rental.id, clientId: client.id },
    });
    created++;
  }

  revalidatePath("/dashboard/rentals");
  revalidatePath("/dashboard/printers");
  return { created, skipped, errors: errors.slice(0, 10) };
}

export async function updateRentalStatus(id: string, status: RentalStatus) {
  await requireAdmin();
  const session = await auth();

  const before = await prisma.rental.findUnique({
    where: { id },
    include: { printer: true },
  });
  if (!before) throw new Error("Rental not found");
  if (before.status === status) return;

  const now = new Date();

  const endDate =
    status === "COMPLETED" || status === "CANCELLED"
      ? before.endDate && before.endDate.getTime() <= now.getTime()
        ? before.endDate
        : now
      : before.status === "COMPLETED" || before.status === "CANCELLED"
        ? null
        : undefined;

  const rental = await prisma.rental.update({
    where: { id },
    data: {
      status,
      ...(endDate !== undefined ? { endDate } : {}),
    },
    include: { printer: true },
  });

  if (before.status !== "PAUSED" && status === "PAUSED") {
    await prisma.rentalPausePeriod.create({
      data: { rentalId: id, pausedAt: now },
    });
  }
  if (before.status === "PAUSED" && status !== "PAUSED") {
    await prisma.rentalPausePeriod.updateMany({
      where: { rentalId: id, resumedAt: null },
      data: { resumedAt: now },
    });
  }

  const { action, message } = rentalStatusAuditMessage(before.status, status);
  await logRentalAudit(rental.id, action, message, {
    userEmail: session?.user?.email,
    metadata: { from: before.status, to: status },
  });

  if (rental.printerId) {
    if (status === "COMPLETED" || status === "CANCELLED") {
      await prisma.printer.update({
        where: { id: rental.printerId },
        data: { status: "AVAILABLE" },
      });
      await logPrinterAudit(
        rental.printerId,
        "STATUS_CHANGED",
        status === "COMPLETED"
          ? "Printer returned — rental completed"
          : "Printer released — rental cancelled",
        { userEmail: session?.user?.email, metadata: { rentalId: id } }
      );
    } else if (status === "ACTIVE" || status === "PAUSED") {
      await prisma.printer.update({
        where: { id: rental.printerId },
        data: { status: "RENTED" },
      });
      if (before.status === "PAUSED" && status === "ACTIVE") {
        await logPrinterAudit(rental.printerId, "STATUS_CHANGED", "Rental resumed on site", {
          userEmail: session?.user?.email,
          metadata: { rentalId: id },
        });
      }
      if (before.status === "ACTIVE" && status === "PAUSED") {
        await logPrinterAudit(
          rental.printerId,
          "NOTE",
          "Rental paused — unit may remain on site during break",
          { userEmail: session?.user?.email, metadata: { rentalId: id } }
        );
      }
    }
  }

  revalidatePath(`/dashboard/rentals/${id}`);
  revalidatePath("/dashboard/rentals");
}

function parsePauseMonths(formData: FormData) {
  const year = Number(formData.get("year"));
  const startMonth = Number(formData.get("startMonth"));
  const endMonthRaw = String(formData.get("endMonth") ?? "").trim();
  const endMonth = endMonthRaw === "" ? startMonth : Number(endMonthRaw);

  if (!Number.isFinite(year) || year < 2000) throw new Error("Invalid year");
  if (!Number.isInteger(startMonth) || startMonth < 0 || startMonth > 11) {
    throw new Error("Invalid start month");
  }
  if (
    endMonth != null &&
    (!Number.isInteger(endMonth) || endMonth < startMonth || endMonth > 11)
  ) {
    throw new Error("End month must be on or after start month");
  }

  return { year, startMonth, endMonth };
}

export async function addRentalPausePeriod(rentalId: string, formData: FormData) {
  await requireAdmin();
  const session = await auth();
  const { year, startMonth, endMonth } = parsePauseMonths(formData);
  const { pausedAt, resumedAt } = pausePeriodDatesFromMonths(year, startMonth, endMonth);

  await prisma.rentalPausePeriod.create({
    data: { rentalId, pausedAt, resumedAt },
  });

  await logRentalAudit(
    rentalId,
    "NOTE",
    `Billing pause added: ${formatPausePeriodRange(pausedAt, resumedAt)}`,
    { userEmail: session?.user?.email }
  );

  revalidatePath(`/dashboard/rentals/${rentalId}`);
  revalidatePath("/dashboard/rentals");
}

export async function deleteRentalPausePeriod(id: string) {
  await requireAdmin();
  const session = await auth();

  const period = await prisma.rentalPausePeriod.findUnique({ where: { id } });
  if (!period) throw new Error("Pause period not found");

  await prisma.rentalPausePeriod.delete({ where: { id } });

  await logRentalAudit(
    period.rentalId,
    "NOTE",
    `Billing pause removed: ${formatPausePeriodRange(period.pausedAt, period.resumedAt)}`,
    { userEmail: session?.user?.email }
  );

  revalidatePath(`/dashboard/rentals/${period.rentalId}`);
  revalidatePath("/dashboard/rentals");
}

export async function addClientPausePeriod(clientId: string, formData: FormData) {
  await requireAdmin();
  const session = await auth();
  const { year, startMonth, endMonth } = parsePauseMonths(formData);
  const { pausedAt, resumedAt } = pausePeriodDatesFromMonths(year, startMonth, endMonth);

  const rentals = await prisma.rental.findMany({
    where: {
      clientId,
      status: { in: ["ACTIVE", "PAUSED"] },
    },
  });
  if (rentals.length === 0) throw new Error("No active rentals for this client");

  const label = formatPausePeriodRange(pausedAt, resumedAt);

  await prisma.$transaction(
    rentals.map((rental) =>
      prisma.rentalPausePeriod.create({
        data: { rentalId: rental.id, pausedAt, resumedAt },
      })
    )
  );

  for (const rental of rentals) {
    await logRentalAudit(rental.id, "NOTE", `Billing pause added (all units): ${label}`, {
      userEmail: session?.user?.email,
    });
  }

  revalidatePath("/dashboard/rentals");
}

export async function deleteClientPausePeriods(ids: string[]) {
  await requireAdmin();
  const session = await auth();
  if (ids.length === 0) return;

  const periods = await prisma.rentalPausePeriod.findMany({
    where: { id: { in: ids } },
  });
  if (periods.length === 0) return;

  const label = formatPausePeriodRange(periods[0].pausedAt, periods[0].resumedAt);
  const rentalIds = new Set(periods.map((p) => p.rentalId));

  await prisma.rentalPausePeriod.deleteMany({ where: { id: { in: ids } } });

  for (const rentalId of rentalIds) {
    await logRentalAudit(rentalId, "NOTE", `Billing pause removed (all units): ${label}`, {
      userEmail: session?.user?.email,
    });
  }

  revalidatePath("/dashboard/rentals");
  for (const rentalId of rentalIds) {
    revalidatePath(`/dashboard/rentals/${rentalId}`);
  }
}

export async function addRentalNote(rentalId: string, note: string) {
  await requireAdmin();
  const session = await auth();
  if (!note.trim()) return;

  await logRentalAudit(rentalId, "NOTE", note.trim(), {
    userEmail: session?.user?.email,
  });
  revalidatePath(`/dashboard/rentals/${rentalId}`);
}
