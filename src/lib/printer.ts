import type { PrinterType } from "@prisma/client";

export const PRINTER_OWNER_ADMIN_LABEL = "Admin";

export function printerTypeLabel(type: PrinterType): string {
  switch (type) {
    case "RENTAL":
      return "Rental";
    case "WALK_IN":
      return "Walk-in";
    default:
      return type;
  }
}

export function formatPrinterOwnerLabel(printer: {
  type: PrinterType;
  ownerClient?: { name: string } | null;
}): string {
  if (printer.type === "WALK_IN") {
    return printer.ownerClient?.name ?? "—";
  }
  return PRINTER_OWNER_ADMIN_LABEL;
}

export function parsePrinterTypeInput(value: string | null | undefined): PrinterType {
  const raw = String(value ?? "RENTAL").trim().toUpperCase();
  if (raw === "WALK_IN") return "WALK_IN";
  return "RENTAL";
}
