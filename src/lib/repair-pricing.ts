import type { RepairPricingMode } from "@prisma/client";
import { listActiveRepairDiagnosisCatalog } from "@/actions/repair-diagnoses";

export type RepairDiagnosisLineInput = {
  name: string;
  price: number;
};

export type ResolvedRepairPricing = {
  diagnosis: string | null;
  totalAmount: number;
  pricingMode: RepairPricingMode;
  lines: RepairDiagnosisLineInput[];
};

function parseDiagnosisNames(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function resolveRepairPricing(input: {
  diagnosisRaw: string | null;
  chargeWaived: boolean;
  pricingMode: RepairPricingMode;
  generalPrice?: number | null;
}): Promise<ResolvedRepairPricing> {
  const selected = parseDiagnosisNames(input.diagnosisRaw);
  const pricingMode = input.pricingMode;

  if (input.chargeWaived) {
    return {
      diagnosis: selected.length > 0 ? selected.join(", ") : null,
      totalAmount: 0,
      pricingMode,
      lines: selected.map((name) => ({ name, price: 0 })),
    };
  }

  if (pricingMode === "GENERAL") {
    const total = Math.max(0, Number(input.generalPrice) || 0);
    const lines: RepairDiagnosisLineInput[] = selected.map((name, index) => ({
      name,
      price: index === selected.length - 1 ? total : 0,
    }));

    if (selected.length === 0 && total > 0) {
      lines.push({ name: "REPAIR", price: total });
    }

    return {
      diagnosis: selected.length > 0 ? selected.join(", ") : lines[0]?.name ?? null,
      totalAmount: total,
      pricingMode,
      lines,
    };
  }

  const catalog = await listActiveRepairDiagnosisCatalog();
  const byName = new Map(catalog.map((entry) => [entry.name.trim().toLowerCase(), entry]));
  let total = 0;
  const matched: string[] = [];
  const unknown: string[] = [];
  const lines: RepairDiagnosisLineInput[] = [];

  for (const name of selected) {
    const entry = byName.get(name.toLowerCase());
    if (!entry) {
      unknown.push(name);
      continue;
    }
    matched.push(entry.name);
    lines.push({ name: entry.name, price: entry.price });
    total += entry.price;
  }

  if (unknown.length > 0) {
    throw new Error(`Unknown diagnosis: ${unknown.join(", ")}`);
  }

  return {
    diagnosis: matched.length > 0 ? matched.join(", ") : null,
    totalAmount: total,
    pricingMode,
    lines,
  };
}

export function sumDiagnosisLinePrices(lines: { price: number }[]): number {
  return lines.reduce((sum, line) => sum + line.price, 0);
}
