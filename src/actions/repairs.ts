"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, auth } from "@/lib/auth";
import { logPrinterAudit } from "@/lib/audit";
import {
  buildRepairDeviceHistory,
  snapshotFromPrinter,
  snapshotFromRepair,
} from "@/lib/repair-device";
import type { RepairPrinterSource, ServiceStatus } from "@prisma/client";

function parseDate(value: string | null | undefined, label: string): Date | null {
  const raw = value?.trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ${label}`);
  d.setHours(12, 0, 0, 0);
  return d;
}

async function printerHasActiveRental(printerId: string): Promise<boolean> {
  const rental = await prisma.rental.findFirst({
    where: {
      printerId,
      status: { in: ["ACTIVE", "PAUSED"] },
    },
  });
  return Boolean(rental);
}

async function resolveRepairDevice(formData: FormData) {
  const source = String(formData.get("source") || "WALK_IN") as RepairPrinterSource;
  const printerId = String(formData.get("printerId") || "").trim() || null;
  const rentalId = String(formData.get("rentalId") || "").trim() || null;
  const historyRepairId = String(formData.get("historyRepairId") || "").trim() || null;
  let clientId = String(formData.get("clientId") || "").trim() || null;
  let customerName = String(formData.get("customerName") || "").trim() || null;

  let brand = String(formData.get("brand") || "").trim() || null;
  let model = String(formData.get("model") || "").trim() || null;
  let serialNumber = String(formData.get("serialNumber") || "").trim() || null;
  let linkedFromRepairId: string | null = null;
  let resolvedPrinterId: string | null = printerId;
  let isChargeWaived = false;

  if (source === "RENTAL") {
    if (!rentalId) throw new Error("Select a rental printer");
    const rental = await prisma.rental.findUnique({
      where: { id: rentalId },
      include: { printer: true, client: true },
    });
    if (!rental?.printerId || !rental.printer) {
      throw new Error("Rental has no printer linked");
    }
    resolvedPrinterId = rental.printerId;
    clientId = rental.clientId;
    customerName = rental.client.name;
    const snap = snapshotFromPrinter(rental.printer);
    brand = snap.brand;
    model = snap.model;
    serialNumber = snap.serialNumber;
    isChargeWaived = true;
  } else if (source === "INVENTORY") {
    if (!printerId) throw new Error("Select a printer from inventory");
    const printer = await prisma.printer.findUnique({ where: { id: printerId } });
    if (!printer) throw new Error("Printer not found");
    const snap = snapshotFromPrinter(printer);
    brand = snap.brand;
    model = snap.model;
    serialNumber = snap.serialNumber;
    isChargeWaived = await printerHasActiveRental(printerId);
  } else if (source === "HISTORY") {
    if (!historyRepairId) throw new Error("Select a device from repair history");
    const prior = await prisma.repair.findUnique({
      where: { id: historyRepairId },
      include: { client: true },
    });
    if (!prior) throw new Error("Previous repair record not found");
    linkedFromRepairId = prior.id;
    const snap = snapshotFromRepair(prior);
    brand = snap.brand;
    model = snap.model;
    serialNumber = snap.serialNumber;
    customerName = customerName || snap.customerName || prior.client?.name || null;
    clientId = clientId || prior.clientId;
    resolvedPrinterId = prior.printerId;
    if (resolvedPrinterId) {
      isChargeWaived = await printerHasActiveRental(resolvedPrinterId);
    }
  } else {
    resolvedPrinterId = null;
    if (!brand && !model && !serialNumber) {
      throw new Error("Enter at least brand, model, or serial number for walk-in devices");
    }
  }

  if (!clientId && !customerName) {
    throw new Error("Select a client or enter a customer name for walk-ins");
  }

  return {
    source,
    clientId,
    customerName,
    printerId: resolvedPrinterId,
    linkedFromRepairId,
    brand,
    model,
    serialNumber,
    isChargeWaived,
  };
}

function parseRepairForm(formData: FormData) {
  const problem = String(formData.get("problem") || "").trim();
  if (!problem) throw new Error("Problem description is required");

  const diagnosis = String(formData.get("diagnosis") || "").trim() || null;
  const status = String(formData.get("status") || "PENDING") as ServiceStatus;
  const receivedAt = parseDate(String(formData.get("receivedAt") || ""), "date received");
  if (!receivedAt) throw new Error("Date received is required");

  const completedAt = parseDate(String(formData.get("completedAt") || ""), "date returned");
  const notes = String(formData.get("notes") || "").trim() || null;

  let totalAmount = Number(formData.get("totalAmount"));
  if (Number.isNaN(totalAmount) || totalAmount < 0) totalAmount = 0;

  const chargeWaivedFlag = formData.get("isChargeWaived") === "on" || formData.get("isChargeWaived") === "true";

  return { problem, diagnosis, status, receivedAt, completedAt, notes, totalAmount, chargeWaivedFlag };
}

export async function getRepairFormOptions() {
  await requireAdmin();

  const [clients, printers, rentals, repairs] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.printer.findMany({
      orderBy: [{ brand: "asc" }, { model: "asc" }],
      select: {
        id: true,
        brand: true,
        model: true,
        serialNumber: true,
        status: true,
      },
    }),
    prisma.rental.findMany({
      where: {
        printerId: { not: null },
        status: { in: ["ACTIVE", "PAUSED"] },
      },
      include: {
        printer: { select: { id: true, brand: true, model: true, serialNumber: true } },
        client: { select: { id: true, name: true } },
      },
      orderBy: { startDate: "desc" },
    }),
    prisma.repair.findMany({
      orderBy: { receivedAt: "desc" },
      select: {
        id: true,
        brand: true,
        model: true,
        serialNumber: true,
        customerName: true,
        receivedAt: true,
        problem: true,
        client: { select: { name: true } },
      },
    }),
  ]);

  const rentalPrinters = rentals
    .filter((r) => r.printer)
    .map((r) => ({
      rentalId: r.id,
      printerId: r.printerId!,
      clientId: r.clientId,
      clientName: r.client.name,
      brand: r.printer!.brand,
      model: r.printer!.model,
      serialNumber: r.printer!.serialNumber,
      label: `${r.client.name} · ${[r.printer!.brand, r.printer!.model, r.printer!.serialNumber].filter(Boolean).join(" ")}`,
    }));

  const printerOptions = printers.map((p) => ({
    id: p.id,
    label: [p.brand, p.model, p.serialNumber].filter(Boolean).join(" ") || "Printer",
    status: p.status,
    brand: p.brand,
    model: p.model,
    serialNumber: p.serialNumber,
  }));

  const deviceHistory = buildRepairDeviceHistory(repairs);

  const activeRentalPrinterIds = new Set(rentalPrinters.map((r) => r.printerId));

  return {
    clients: clients.map((c) => ({ id: c.id, label: c.name })),
    printers: printerOptions.map((p) => ({
      ...p,
      isRentalUnit: activeRentalPrinterIds.has(p.id),
    })),
    rentalPrinters,
    deviceHistory,
  };
}

export async function createRepair(formData: FormData) {
  await requireAdmin();
  const session = await auth();

  const device = await resolveRepairDevice(formData);
  const fields = parseRepairForm(formData);

  let isChargeWaived = device.isChargeWaived || fields.chargeWaivedFlag;
  let totalAmount = isChargeWaived ? 0 : fields.totalAmount;

  const repair = await prisma.repair.create({
    data: {
      clientId: device.clientId,
      customerName: device.customerName,
      printerId: device.printerId,
      source: device.source,
      linkedFromRepairId: device.linkedFromRepairId,
      brand: device.brand,
      model: device.model,
      serialNumber: device.serialNumber,
      problem: fields.problem,
      diagnosis: fields.diagnosis,
      status: fields.status,
      totalAmount,
      isChargeWaived,
      receivedAt: fields.receivedAt,
      completedAt: fields.completedAt,
      title: fields.problem.slice(0, 120),
      description: fields.notes,
    },
  });

  if (device.printerId && fields.status !== "COMPLETED" && fields.status !== "CANCELLED") {
    await prisma.printer.update({
      where: { id: device.printerId },
      data: { status: "IN_REPAIR" },
    });
    await logPrinterAudit(device.printerId, "REPAIR_LINKED", `Repair opened: ${fields.problem}`, {
      userEmail: session?.user?.email,
      metadata: { repairId: repair.id },
    });
  }

  revalidatePath("/dashboard/repairs");
  revalidatePath("/dashboard/printers");
  if (device.printerId) revalidatePath(`/dashboard/printers/${device.printerId}`);
}

export async function updateRepair(id: string, formData: FormData) {
  await requireAdmin();
  const session = await auth();

  const existing = await prisma.repair.findUnique({ where: { id } });
  if (!existing) throw new Error("Repair not found");

  const device = await resolveRepairDevice(formData);
  const fields = parseRepairForm(formData);

  let isChargeWaived = device.isChargeWaived || fields.chargeWaivedFlag;
  let totalAmount = isChargeWaived ? 0 : fields.totalAmount;

  const repair = await prisma.repair.update({
    where: { id },
    data: {
      clientId: device.clientId,
      customerName: device.customerName,
      printerId: device.printerId,
      source: device.source,
      linkedFromRepairId: device.linkedFromRepairId,
      brand: device.brand,
      model: device.model,
      serialNumber: device.serialNumber,
      problem: fields.problem,
      diagnosis: fields.diagnosis,
      status: fields.status,
      totalAmount,
      isChargeWaived,
      receivedAt: fields.receivedAt,
      completedAt: fields.completedAt,
      title: fields.problem.slice(0, 120),
      description: fields.notes,
    },
    include: { printer: true },
  });

  if (repair.printerId) {
    if (fields.status === "COMPLETED" || fields.status === "CANCELLED") {
      const activeRental = await prisma.rental.findFirst({
        where: { printerId: repair.printerId, status: { in: ["ACTIVE", "PAUSED"] } },
      });
      await prisma.printer.update({
        where: { id: repair.printerId },
        data: { status: activeRental ? "RENTED" : "AVAILABLE" },
      });
      if (fields.status === "COMPLETED") {
        await logPrinterAudit(repair.printerId, "STATUS_CHANGED", "Repair completed", {
          userEmail: session?.user?.email,
          metadata: { repairId: id },
        });
      }
    } else {
      await prisma.printer.update({
        where: { id: repair.printerId },
        data: { status: "IN_REPAIR" },
      });
    }
  }

  revalidatePath("/dashboard/repairs");
  revalidatePath(`/dashboard/repairs/${id}`);
  revalidatePath("/dashboard/printers");
  if (repair.printerId) revalidatePath(`/dashboard/printers/${repair.printerId}`);
}

export async function updateRepairStatus(id: string, status: ServiceStatus) {
  await requireAdmin();
  const session = await auth();
  const repair = await prisma.repair.update({
    where: { id },
    data: {
      status,
      completedAt: status === "COMPLETED" ? new Date() : undefined,
    },
    include: { printer: true },
  });

  if (repair.printerId && status === "COMPLETED") {
    const activeRental = await prisma.rental.findFirst({
      where: { printerId: repair.printerId, status: "ACTIVE" },
    });
    await prisma.printer.update({
      where: { id: repair.printerId },
      data: { status: activeRental ? "RENTED" : "AVAILABLE" },
    });
    await logPrinterAudit(
      repair.printerId,
      "STATUS_CHANGED",
      "Repair completed",
      { userEmail: session?.user?.email, metadata: { repairId: id } }
    );
  }

  revalidatePath(`/dashboard/repairs/${id}`);
  revalidatePath("/dashboard/repairs");
}

export async function getRepairDeviceTimeline(serialNumber: string | null, brand: string | null, model: string | null) {
  await requireAdmin();

  const sn = serialNumber?.trim();
  if (!sn && !brand?.trim() && !model?.trim()) return [];

  const where = sn
    ? { serialNumber: { equals: sn, mode: "insensitive" as const } }
    : {
        AND: [
          brand?.trim()
            ? { brand: { equals: brand.trim(), mode: "insensitive" as const } }
            : {},
          model?.trim()
            ? { model: { equals: model.trim(), mode: "insensitive" as const } }
            : {},
        ],
      };

  return prisma.repair.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    include: { client: true, payments: true },
  });
}
