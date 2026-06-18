import type { Repair, RepairPrinterSource, Printer, Client } from "@prisma/client";

export type RepairWithSnapshot = Repair & {
  printer?: Printer | null;
  client?: Client | null;
};

export type RepairDeviceHistoryOption = {
  id: string;
  label: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  customerName: string | null;
  clientName: string | null;
  lastReceivedAt: Date;
  repairCount: number;
};

export type RentalPrinterOption = {
  rentalId: string;
  printerId: string;
  label: string;
  clientId: string;
  clientName: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
};

export function normalizeSerial(serial: string | null | undefined): string | null {
  const s = serial?.trim();
  return s ? s.toLowerCase() : null;
}

export function deviceKey(
  brand: string | null | undefined,
  model: string | null | undefined,
  serial: string | null | undefined
): string {
  const sn = normalizeSerial(serial);
  if (sn) return `sn:${sn}`;
  return `bm:${(brand ?? "").trim().toLowerCase()}|${(model ?? "").trim().toLowerCase()}`;
}

export function formatRepairPrinterLabel(repair: {
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  printer?: { brand: string | null; model: string | null; serialNumber: string | null } | null;
}): string {
  const brand = repair.brand ?? repair.printer?.brand;
  const model = repair.model ?? repair.printer?.model;
  const serial = repair.serialNumber ?? repair.printer?.serialNumber;
  const main = [brand, model].filter(Boolean).join(" ");
  if (main && serial) return `${main} · ${serial}`;
  return main || serial || "—";
}

export function formatRepairCustomerLabel(repair: {
  customerName?: string | null;
  client?: { name: string } | null;
}): string {
  return repair.client?.name ?? repair.customerName ?? "Walk-in";
}

export function repairDisplayTitle(repair: { problem: string; title?: string | null }): string {
  return repair.problem || repair.title || "Repair";
}

export function sourceLabel(source: RepairPrinterSource): string {
  switch (source) {
    case "INVENTORY":
      return "My printer";
    case "RENTAL":
      return "Rental unit";
    case "WALK_IN":
      return "Walk-in / other";
    case "HISTORY":
      return "Previous repair";
    default:
      return source;
  }
}

export function buildRepairDeviceHistory(
  repairs: {
    id: string;
    brand: string | null;
    model: string | null;
    serialNumber: string | null;
    customerName: string | null;
    client: { name: string } | null;
    receivedAt: Date;
    problem: string;
  }[]
): RepairDeviceHistoryOption[] {
  const byKey = new Map<string, RepairDeviceHistoryOption & { ids: Set<string> }>();

  for (const r of repairs) {
    const key = deviceKey(r.brand, r.model, r.serialNumber);
    const label = formatRepairPrinterLabel(r);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        id: r.id,
        label,
        brand: r.brand,
        model: r.model,
        serialNumber: r.serialNumber,
        customerName: r.customerName,
        clientName: r.client?.name ?? null,
        lastReceivedAt: r.receivedAt,
        repairCount: 1,
        ids: new Set([r.id]),
      });
      continue;
    }
    existing.ids.add(r.id);
    existing.repairCount += 1;
    if (r.receivedAt > existing.lastReceivedAt) {
      existing.id = r.id;
      existing.lastReceivedAt = r.receivedAt;
      existing.customerName = r.customerName;
      existing.clientName = r.client?.name ?? null;
    }
  }

  return Array.from(byKey.values())
    .map(({ id, label, brand, model, serialNumber, customerName, clientName, lastReceivedAt, repairCount }) => ({
      id,
      label,
      brand,
      model,
      serialNumber,
      customerName,
      clientName,
      lastReceivedAt,
      repairCount,
    }))
    .sort((a, b) => b.lastReceivedAt.getTime() - a.lastReceivedAt.getTime());
}

export function snapshotFromPrinter(printer: {
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
}) {
  return {
    brand: printer.brand,
    model: printer.model,
    serialNumber: printer.serialNumber,
  };
}

export function snapshotFromRepair(repair: {
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  customerName: string | null;
}) {
  return {
    brand: repair.brand,
    model: repair.model,
    serialNumber: repair.serialNumber,
    customerName: repair.customerName,
  };
}
