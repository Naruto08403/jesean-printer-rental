"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, auth } from "@/lib/auth";
import { logPrinterAudit } from "@/lib/audit";
import type { PrinterStatus } from "@prisma/client";

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

export async function addPrinterNote(printerId: string, note: string) {
  await requireAdmin();
  const session = await auth();
  if (!note.trim()) return;

  await logPrinterAudit(printerId, "NOTE", note.trim(), {
    userEmail: session?.user?.email,
  });
  revalidatePath(`/dashboard/printers/${printerId}`);
}
