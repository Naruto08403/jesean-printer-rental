"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, auth } from "@/lib/auth";
import { logPrinterAudit } from "@/lib/audit";
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

  if (printerId) {
    await prisma.printer.update({
      where: { id: printerId },
      data: { status: "RENTED" },
    });
    await logPrinterAudit(printerId, "RENTAL_LINKED", `Rental started for client`, {
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
      where: { printerId: printer.id, status: "ACTIVE" },
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
    const validStatuses: RentalStatus[] = ["ACTIVE", "COMPLETED", "CANCELLED"];
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

    await prisma.printer.update({
      where: { id: printer.id },
      data: { status: "RENTED" },
    });
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
  const rental = await prisma.rental.update({
    where: { id },
    data: { status },
    include: { printer: true },
  });

  if (rental.printerId && status === "COMPLETED") {
    await prisma.printer.update({
      where: { id: rental.printerId },
      data: { status: "AVAILABLE" },
    });
    await logPrinterAudit(
      rental.printerId,
      "STATUS_CHANGED",
      "Printer returned — rental completed",
      { userEmail: session?.user?.email, metadata: { rentalId: id } }
    );
  }

  revalidatePath(`/dashboard/rentals/${id}`);
  revalidatePath("/dashboard/rentals");
}
