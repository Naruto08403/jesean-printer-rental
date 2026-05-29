"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, auth } from "@/lib/auth";
import { logPrinterAudit } from "@/lib/audit";
import type { PrinterStatus } from "@prisma/client";
import Papa from "papaparse";

export async function createPrinter(formData: FormData) {
  await requireAdmin();
  const session = await auth();
  const serialNumber = String(formData.get("serialNumber") || "").trim() || null;
  const brand = String(formData.get("brand") || "").trim() || null;
  const model = String(formData.get("model") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  const printer = await prisma.printer.create({
    data: { serialNumber, brand, model, notes },
  });

  await logPrinterAudit(printer.id, "CREATED", "Printer added to inventory", {
    userEmail: session?.user?.email,
    metadata: { serialNumber, brand, model },
  });

  revalidatePath("/dashboard/printers");
}

export async function updatePrinter(id: string, formData: FormData) {
  await requireAdmin();
  const session = await auth();
  const status = formData.get("status") as PrinterStatus;
  const data = {
    serialNumber: String(formData.get("serialNumber") || "").trim() || null,
    brand: String(formData.get("brand") || "").trim() || null,
    model: String(formData.get("model") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
    status,
  };

  await prisma.printer.update({ where: { id }, data });
  await logPrinterAudit(id, "UPDATED", "Printer details updated", {
    userEmail: session?.user?.email,
    metadata: data,
  });

  revalidatePath("/dashboard/printers");
  revalidatePath(`/dashboard/printers/${id}`);
}

export async function importPrintersFromCsv(csvText: string) {
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

  for (const row of parsed.data) {
    const serialNumber =
      row.serial_number?.trim() ||
      row.serial?.trim() ||
      row.serialnumber?.trim();
    if (!serialNumber) continue;

    const existing = await prisma.printer.findUnique({ where: { serialNumber } });
    if (existing) {
      skipped++;
      continue;
    }

    const status = (row.status?.trim().toUpperCase() || "AVAILABLE") as PrinterStatus;
    const validStatuses: PrinterStatus[] = [
      "AVAILABLE",
      "RENTED",
      "IN_REPAIR",
      "RETIRED",
    ];
    const printerStatus = validStatuses.includes(status) ? status : "AVAILABLE";

    const printer = await prisma.printer.create({
      data: {
        serialNumber,
        brand: row.brand?.trim() || null,
        model: row.model?.trim() || null,
        notes: [row.notes?.trim(), row.client_name?.trim() && `Client: ${row.client_name.trim()}`]
          .filter(Boolean)
          .join(" · ") || null,
        status: printerStatus,
      },
    });

    await logPrinterAudit(printer.id, "CREATED", "Imported from CSV", {
      userEmail: session?.user?.email ?? undefined,
      metadata: { serialNumber, client: row.client_name },
    });
    created++;
  }

  revalidatePath("/dashboard/printers");
  return { created, skipped };
}

export async function addPrinterNote(printerId: string, note: string) {
  await requireAdmin();
  const session = await auth();
  if (!note.trim()) return;

  await logPrinterAudit(printerId, "NOTE", note.trim(), {
    userEmail: session?.user?.email,
  });
  revalidatePath(`/dashboard/printers/${printerId}`);
}
