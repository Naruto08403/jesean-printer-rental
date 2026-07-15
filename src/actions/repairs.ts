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
import type { RepairPrinterSource, ServiceStatus, RepairPricingMode } from "@prisma/client";
import { resolveRepairPricing } from "@/lib/repair-pricing";
import { listActiveRepairDiagnosisCatalog } from "@/actions/repair-diagnoses";

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

async function isRentalFleetPrinter(printerId: string): Promise<boolean> {
  const printer = await prisma.printer.findUnique({
    where: { id: printerId },
    select: { type: true },
  });
  return printer?.type === "RENTAL";
}

async function resolveRepairDevice(formData: FormData) {
  const isEdit = formData.get("isEdit") === "true";
  const source = String(formData.get("source") || "WALK_IN") as RepairPrinterSource;
  const printerId = String(formData.get("printerId") || "").trim() || null;
  const rentalId = String(formData.get("rentalId") || "").trim() || null;
  const historyRepairId = String(formData.get("historyRepairId") || "").trim() || null;
  let clientId = String(formData.get("clientId") || "").trim() || null;
  let customerName = String(formData.get("customerName") || "").trim() || null;

  let brand = String(formData.get("brand") || "").trim() || null;
  let model = String(formData.get("model") || "").trim() || null;
  let serialNumber = String(formData.get("serialNumber") || "").trim() || null;
  const hasFormDevice = Boolean(brand || model || serialNumber);
  

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
    if (!isEdit || !hasFormDevice) {
      const snap = snapshotFromPrinter(rental.printer);
      brand = snap.brand;
      model = snap.model;
      serialNumber = snap.serialNumber;
    }
    isChargeWaived = true;
  } else if (source === "INVENTORY") {
    if (!printerId) throw new Error("Select a printer from inventory");
    const printer = await prisma.printer.findUnique({ where: { id: printerId } });
    if (!printer) throw new Error("Printer not found");
    if (printer.type !== "RENTAL") {
      throw new Error("Select a rental fleet printer from inventory");
    }
    if (!isEdit || !hasFormDevice) {
      const snap = snapshotFromPrinter(printer);
      brand = snap.brand;
      model = snap.model;
      serialNumber = snap.serialNumber;
    }
    isChargeWaived = await printerHasActiveRental(printerId);
  } else if (source === "HISTORY") {
    if (!historyRepairId) throw new Error("Select a device from repair history");
    const prior = await prisma.repair.findUnique({
      where: { id: historyRepairId },
      include: { client: true },
    });
    if (!prior) throw new Error("Previous repair record not found");
    linkedFromRepairId = prior.id;
    if (!isEdit || !hasFormDevice) {
      const snap = snapshotFromRepair(prior);
      brand = snap.brand;
      model = snap.model;
      serialNumber = snap.serialNumber;
    }
    customerName = customerName || prior.customerName || prior.client?.name || null;
    clientId = clientId || prior.clientId;
    resolvedPrinterId = prior.printerId;
    if (resolvedPrinterId) {
      isChargeWaived = await printerHasActiveRental(resolvedPrinterId);
    }
  } else {
    if (printerId) {
      const printer = await prisma.printer.findUnique({
        where: { id: printerId },
        include: { ownerClient: { select: { id: true, name: true } } },
      });
      if (!printer || printer.type !== "WALK_IN") {
        throw new Error("Select a registered walk-in printer");
      }
      resolvedPrinterId = printerId;
      if (!isEdit || !hasFormDevice) {
        const snap = snapshotFromPrinter(printer);
        brand = snap.brand;
        model = snap.model;
        serialNumber = snap.serialNumber;
      }
      clientId = clientId || printer.ownerClientId;
      customerName = customerName || printer.ownerClient?.name || null;
    } else {
      resolvedPrinterId = null;
      if (!brand && !model && !serialNumber) {
        throw new Error("Enter at least brand, model, or serial number for walk-in devices");
      }
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

  const chargeWaivedFlag = formData.get("isChargeWaived") === "on" || formData.get("isChargeWaived") === "true";
  const pricingMode = (String(formData.get("pricingMode") || "CATALOG") === "GENERAL"
    ? "GENERAL"
    : "CATALOG") as RepairPricingMode;
  const generalPriceRaw = String(formData.get("generalPrice") || "").trim();
  const generalPrice = generalPriceRaw ? Number(generalPriceRaw) : null;

  return {
    problem,
    diagnosis,
    status,
    receivedAt,
    completedAt,
    notes,
    chargeWaivedFlag,
    pricingMode,
    generalPrice,
  };
}

async function replaceRepairDiagnosisLines(
  repairId: string,
  lines: { name: string; price: number }[]
) {
  await prisma.repairDiagnosisLine.deleteMany({ where: { repairId } });
  if (lines.length === 0) return;
  await prisma.repairDiagnosisLine.createMany({
    data: lines.map((line, index) => ({
      repairId,
      name: line.name,
      price: line.price,
      sortOrder: index,
    })),
  });
}

export async function getRepairFormOptions() {
  await requireAdmin();

  const [clients, printers, rentals, repairs, diagnosisCatalog] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.printer.findMany({
      orderBy: [{ brand: "asc" }, { model: "asc" }],
      select: {
        id: true,
        brand: true,
        model: true,
        serialNumber: true,
        status: true,
        type: true,
        ownerClientId: true,
        ownerClient: { select: { name: true } },
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
        billingDate: true,
        problem: true,
        client: { select: { name: true } },
      },
    }),
    listActiveRepairDiagnosisCatalog(),
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

  const rentalFleetPrinters = printers.filter((p) => p.type === "RENTAL");
  const walkInPrinters = printers.filter((p) => p.type === "WALK_IN");

  const printerOptions = rentalFleetPrinters.map((p) => ({
    id: p.id,
    label: [p.brand, p.model, p.serialNumber].filter(Boolean).join(" ") || "Printer",
    status: p.status,
    type: p.type,
    brand: p.brand,
    model: p.model,
    serialNumber: p.serialNumber,
  }));

  const walkInPrinterOptions = walkInPrinters.map((p) => ({
    id: p.id,
    label: [p.brand, p.model, p.serialNumber].filter(Boolean).join(" ") || "Printer",
    ownerLabel: p.ownerClient?.name ?? "—",
    ownerClientId: p.ownerClientId,
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
    walkInPrinters: walkInPrinterOptions,
    rentalPrinters,
    deviceHistory,
    diagnosisCatalog,
  };
}

export async function createRepair(formData: FormData) {
  await requireAdmin();
  const session = await auth();

  const device = await resolveRepairDevice(formData);
  const fields = parseRepairForm(formData);

  let printerId = device.printerId;
  if (device.source === "WALK_IN" && !printerId && device.clientId) {
    const walkInPrinter = await prisma.printer.create({
      data: {
        type: "WALK_IN",
        ownerClientId: device.clientId,
        brand: device.brand,
        model: device.model,
        serialNumber: device.serialNumber,
        status: "AVAILABLE",
      },
    });
    printerId = walkInPrinter.id;
    await logPrinterAudit(walkInPrinter.id, "CREATED", "Walk-in printer registered from repair", {
      userEmail: session?.user?.email,
      metadata: { repairSource: "WALK_IN" },
    });
  }

  const isChargeWaived = device.isChargeWaived || fields.chargeWaivedFlag;
  const pricing = await resolveRepairPricing({
    diagnosisRaw: fields.diagnosis,
    chargeWaived: isChargeWaived,
    pricingMode: fields.pricingMode,
    generalPrice: fields.generalPrice,
  });

  const billingDate = parseDate(String(formData.get("billingDate") || ""), "billing date");
  billingDate: billingDate ? new Date(billingDate) : null;

  const repair = await prisma.repair.create({
    data: {
      clientId: device.clientId,
      customerName: device.customerName,
      printerId,
      source: device.source,
      linkedFromRepairId: device.linkedFromRepairId,
      brand: device.brand,
      model: device.model,
      serialNumber: device.serialNumber,
      problem: fields.problem,
      diagnosis: pricing.diagnosis,
      pricingMode: pricing.pricingMode,
      billingDate: billingDate,
      status: fields.status,
      totalAmount: pricing.totalAmount,
      isChargeWaived,
      receivedAt: fields.receivedAt,
      completedAt: fields.completedAt,
      title: fields.problem.slice(0, 120),
      description: fields.notes,
    },
  });

  await replaceRepairDiagnosisLines(repair.id, pricing.lines);

  if (printerId && fields.status !== "COMPLETED" && fields.status !== "CANCELLED") {
    if (await isRentalFleetPrinter(printerId)) {
      await prisma.printer.update({
        where: { id: printerId },
        data: { status: "IN_REPAIR" },
      });
      await logPrinterAudit(printerId, "REPAIR_LINKED", `Repair opened: ${fields.problem}`, {
        userEmail: session?.user?.email,
        metadata: { repairId: repair.id },
      });
    }
  }

  revalidatePath("/dashboard/repairs");
  revalidatePath("/dashboard/printers");
  if (printerId) revalidatePath(`/dashboard/printers/${printerId}`);

  return { id: repair.id };
}

export async function updateRepair(id: string, formData: FormData) {
  await requireAdmin();
  const session = await auth();

  const existing = await prisma.repair.findUnique({ where: { id } });
  if (!existing) throw new Error("Repair not found");

  const device = await resolveRepairDevice(formData);
  const fields = parseRepairForm(formData);

  const isChargeWaived = device.isChargeWaived || fields.chargeWaivedFlag;
  const pricing = await resolveRepairPricing({
    diagnosisRaw: fields.diagnosis,
    chargeWaived: isChargeWaived,
    pricingMode: fields.pricingMode,
    generalPrice: fields.generalPrice,
  });

  const billingDate = parseDate(String(formData.get("billingDate") || ""), "billing date");
  billingDate: billingDate ? new Date(billingDate) : null;

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
      billingDate: billingDate,
      serialNumber: device.serialNumber,
      problem: fields.problem,
      diagnosis: pricing.diagnosis,
      pricingMode: pricing.pricingMode,
      status: fields.status,
      totalAmount: pricing.totalAmount,
      isChargeWaived,
      receivedAt: fields.receivedAt,
      completedAt: fields.completedAt,
      title: fields.problem.slice(0, 120),
      description: fields.notes,
    },
    include: { printer: true },
  });

  await replaceRepairDiagnosisLines(repair.id, pricing.lines);

  if (repair.printerId) {
    const fleet = await isRentalFleetPrinter(repair.printerId);
    if (fleet) {
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

  if (repair.printerId && status === "COMPLETED" && (await isRentalFleetPrinter(repair.printerId))) {
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

export async function deleteRepair(id: string) {
  await requireAdmin();
  const session = await auth();

  const repair = await prisma.repair.findUnique({
    where: { id },
    include: { payments: { select: { id: true } } },
  });
  if (!repair) throw new Error("Repair not found");

  if (repair.printerId && (await isRentalFleetPrinter(repair.printerId))) {
    const isOpen = repair.status !== "COMPLETED" && repair.status !== "CANCELLED";
    if (isOpen) {
      const otherOpenRepair = await prisma.repair.findFirst({
        where: {
          printerId: repair.printerId,
          id: { not: id },
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
      });
      if (!otherOpenRepair) {
        const activeRental = await prisma.rental.findFirst({
          where: {
            printerId: repair.printerId,
            status: { in: ["ACTIVE", "PAUSED"] },
          },
        });
        await prisma.printer.update({
          where: { id: repair.printerId },
          data: { status: activeRental ? "RENTED" : "AVAILABLE" },
        });
        await logPrinterAudit(repair.printerId, "STATUS_CHANGED", "Repair record deleted", {
          userEmail: session?.user?.email,
          metadata: { repairId: id },
        });
      }
    }
  }

  await prisma.repair.delete({ where: { id } });

  revalidatePath("/dashboard/repairs");
  revalidatePath(`/dashboard/repairs/${id}`);
  revalidatePath("/dashboard/printers");
  if (repair.printerId) revalidatePath(`/dashboard/printers/${repair.printerId}`);
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
