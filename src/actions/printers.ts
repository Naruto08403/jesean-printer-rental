"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, auth } from "@/lib/auth";
import { logPrinterAudit } from "@/lib/audit";
import { parsePrinterTypeInput } from "@/lib/printer";
import type { PrinterStatus, PrinterType } from "@prisma/client";
import Papa from "papaparse";

function parsePrinterOwner(type: PrinterType, ownerClientIdRaw: string | null) {
  if (type === "RENTAL") return null;
  const ownerClientId = ownerClientIdRaw?.trim() || null;
  if (!ownerClientId) {
    throw new Error("Select an owner client for walk-in printers");
  }
  return ownerClientId;
}

function parsePrinterFormFields(formData: FormData) {
  const serialNumber = String(formData.get("serialNumber") || "").trim() || null;
  const brand = String(formData.get("brand") || "").trim() || null;
  const model = String(formData.get("model") || "").trim() || null;
  const priceRaw = String(formData.get("price") || "").trim();
  const price = priceRaw ? Number(priceRaw) : null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const type = parsePrinterTypeInput(String(formData.get("type") || ""));
  const ownerClientId = parsePrinterOwner(
    type,
    String(formData.get("ownerClientId") || "")
  );

  if (price != null && (!Number.isFinite(price) || price < 0)) {
    throw new Error("Invalid price");
  }

  return { serialNumber, brand, model, price, notes, type, ownerClientId };
}

export async function createPrinter(formData: FormData) {
  await requireAdmin();
  const session = await auth();
  const data = parsePrinterFormFields(formData);

  const printer = await prisma.printer.create({
    data: {
      serialNumber: data.serialNumber,
      brand: data.brand,
      model: data.model,
      price: data.price,
      notes: data.notes,
      type: data.type,
      ownerClientId: data.ownerClientId,
    },
  });

  await logPrinterAudit(printer.id, "CREATED", "Printer added to inventory", {
    userEmail: session?.user?.email,
    metadata: {
      serialNumber: data.serialNumber,
      brand: data.brand,
      model: data.model,
      price: data.price,
      type: data.type,
      ownerClientId: data.ownerClientId,
    },
  });

  revalidatePath("/dashboard/printers");
}

export async function updatePrinter(id: string, formData: FormData) {
  await requireAdmin();
  const session = await auth();
  const status = formData.get("status") as PrinterStatus;
  const fields = parsePrinterFormFields(formData);

  const data = {
    serialNumber: fields.serialNumber,
    brand: fields.brand,
    model: fields.model,
    price: fields.price,
    notes: fields.notes,
    type: fields.type,
    ownerClientId: fields.ownerClientId,
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
    const parsedPrice = row.price?.trim() ? Number(row.price.trim()) : null;
    const price = parsedPrice != null && Number.isFinite(parsedPrice) && parsedPrice >= 0
      ? parsedPrice
      : null;

    const typeRaw = row.type?.trim().toLowerCase() || row.printer_type?.trim().toLowerCase();
    const type: PrinterType =
      typeRaw === "walk_in" || typeRaw === "walkin" || typeRaw === "walk-in"
        ? "WALK_IN"
        : "RENTAL";

    let ownerClientId: string | null = null;
    if (type === "WALK_IN" && row.client_name?.trim()) {
      const client = await prisma.client.findFirst({
        where: { name: { equals: row.client_name.trim(), mode: "insensitive" } },
        select: { id: true },
      });
      ownerClientId = client?.id ?? null;
    }

    const printer = await prisma.printer.create({
      data: {
        serialNumber,
        brand: row.brand?.trim() || null,
        model: row.model?.trim() || null,
        price,
        notes: row.notes?.trim() || null,
        status: printerStatus,
        type,
        ownerClientId,
      },
    });

    await logPrinterAudit(printer.id, "CREATED", "Imported from CSV", {
      userEmail: session?.user?.email ?? undefined,
      metadata: { serialNumber, client: row.client_name, type },
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

export async function getPrinterFormClients() {
  await requireAdmin();
  return prisma.client.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
