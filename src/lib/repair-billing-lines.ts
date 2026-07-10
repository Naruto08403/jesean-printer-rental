import { repairDisplayTitle } from "@/lib/repair-device";

export type RepairTemplateLineItem = {
  unitLabel: string;
  description: string;
  amount: number | null;
  isPrimary: boolean;
};

export type RepairBillingRepairRecord = {
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  problem: string;
  diagnosis?: string | null;
  totalAmount: number;
  printer?: { brand: string | null; model: string | null; serialNumber: string | null } | null;
};

export function parseDiagnosisItems(
  diagnosis: string | null | undefined,
  fallbackProblem: string
): string[] {
  const raw = diagnosis?.trim();
  if (raw) {
    const items = raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (items.length > 0) return items.map((item) => item.toUpperCase());
  }

  const fallback = fallbackProblem.trim();
  return [(fallback || "REPAIR").toUpperCase()];
}

export function formatRepairUnitLabel(repair: {
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  printer?: { brand: string | null; model: string | null; serialNumber: string | null } | null;
}): string {
  const brand = repair.brand ?? repair.printer?.brand;
  const serial = repair.serialNumber ?? repair.printer?.serialNumber;
  if (brand && serial) return `${brand.toUpperCase()} SN:${serial}`;
  if (brand) return brand.toUpperCase();
  const model = repair.model ?? repair.printer?.model;
  if (model) return model.toUpperCase();
  return "";
}

export function buildTemplateLineItems(
  repairs: RepairBillingRepairRecord[]
): RepairTemplateLineItem[] {
  return repairs.flatMap((repair) => buildTemplateLineItemsForRepair(repair));
}

export function buildTemplateLineItemsForRepair(
  repair: RepairBillingRepairRecord
): RepairTemplateLineItem[] {
  const unitLabel = formatRepairUnitLabel(repair);
  const descriptions = parseDiagnosisItems(repair.diagnosis, repairDisplayTitle(repair));

  return descriptions.map((description, index) => ({
    unitLabel: index === 0 ? unitLabel : "",
    description,
    amount: index === 0 ? repair.totalAmount : null,
    isPrimary: index === 0,
  }));
}

export function repairBillingLineTotal(items: RepairTemplateLineItem[]): number {
  return items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
}
