import { repairDisplayTitle } from "@/lib/repair-device";

export type RepairTemplateLineItem = {
  unitLabel: string;
  description: string;
  amount: number | null;
  isPrimary: boolean;
  repairId?: string;
};

export type RepairBillingPreviewItem = RepairTemplateLineItem & {
  key: string;
};

export type RepairBillingRepairRecord = {
  id?: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  problem: string;
  diagnosis?: string | null;
  totalAmount: number;
  pricingMode?: "CATALOG" | "GENERAL";
  diagnosisLines?: { name: string; price: number }[];
  printer?: { brand: string | null; model: string | null; serialNumber: string | null } | null;
};

export type DiagnosisPriceEntry = {
  name: string;
  price: number;
};

function normalizeDiagnosisName(name: string) {
  return name.trim().toLowerCase();
}

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

/** Comma-separated diagnosis text wrapped at maxLen characters per line. */
export function wrapDiagnosisCommaSeparated(items: string[], maxLen = 50): string[] {
  const lines: string[] = [];
  let current = "";

  for (const item of items) {
    const candidate = current ? `${current}, ${item}` : item;
    if (candidate.length <= maxLen) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = item;
      continue;
    }

    lines.push(item);
    current = "";
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
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

export function resolveJobOrderDiagnosisPrices(
  diagnoses: string[],
  totalAmount: number,
  catalog: DiagnosisPriceEntry[] = []
): { name: string; price: number }[] {
  const byName = new Map(
    catalog.map((entry) => [normalizeDiagnosisName(entry.name), entry])
  );

  const rows = diagnoses.map((name) => {
    const entry = byName.get(normalizeDiagnosisName(name));
    return {
      name: entry?.name.toUpperCase() ?? name,
      price: entry?.price ?? 0,
    };
  });

  const catalogSum = rows.reduce((sum, row) => sum + row.price, 0);
  if (rows.length === 0) return rows;

  const delta = totalAmount - catalogSum;
  if (Math.abs(delta) > 0.001) {
    const laborIndex = rows.findIndex((row) => normalizeDiagnosisName(row.name) === "labor");
    const adjustIndex = laborIndex >= 0 ? laborIndex : rows.length - 1;
    rows[adjustIndex] = {
      ...rows[adjustIndex],
      price: rows[adjustIndex].price + delta,
    };
  }

  return rows;
}

/** Billing statement: one row per printer with comma-wrapped diagnoses and repair total. */
export function buildBillingStatementLineItems(
  repairs: RepairBillingRepairRecord[]
): RepairTemplateLineItem[] {
  return repairs.map((repair) => {
    const diagnoses = parseDiagnosisItems(repair.diagnosis, repairDisplayTitle(repair));
    const wrapped = wrapDiagnosisCommaSeparated(diagnoses, 50);

    return {
      unitLabel: formatRepairUnitLabel(repair),
      description: wrapped.join("\n"),
      amount: repair.totalAmount,
      isPrimary: true,
      repairId: repair.id,
    };
  });
}

/** Job order: one row per diagnosis using saved line prices when available. */
export function buildJobOrderLineItems(
  repairs: RepairBillingRepairRecord[],
  catalog: DiagnosisPriceEntry[] = []
): RepairTemplateLineItem[] {
  return repairs.flatMap((repair) => {
    if (repair.diagnosisLines && repair.diagnosisLines.length > 0) {
      return repair.diagnosisLines.map((row, index) => ({
        unitLabel: index === 0 ? formatRepairUnitLabel(repair) : "",
        description: row.name.toUpperCase(),
        amount: row.price,
        isPrimary: index === 0,
        repairId: repair.id,
      }));
    }

    const diagnoses = parseDiagnosisItems(repair.diagnosis, repairDisplayTitle(repair));
    const priced = resolveJobOrderDiagnosisPrices(diagnoses, repair.totalAmount, catalog);

    return priced.map((row, index) => ({
      unitLabel: index === 0 ? formatRepairUnitLabel(repair) : "",
      description: row.name,
      amount: row.price,
      isPrimary: index === 0,
      repairId: repair.id,
    }));
  });
}

/** @deprecated Use buildBillingStatementLineItems or buildJobOrderLineItems */
export function buildTemplateLineItems(
  repairs: RepairBillingRepairRecord[]
): RepairTemplateLineItem[] {
  return buildJobOrderLineItems(repairs);
}

export function buildTemplateLineItemsForRepair(
  repair: RepairBillingRepairRecord
): RepairTemplateLineItem[] {
  return buildJobOrderLineItems([repair]);
}

export function repairBillingLineTotal(items: RepairTemplateLineItem[]): number {
  return items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
}

export function padLineItems(
  items: RepairTemplateLineItem[],
  minRows: number
): RepairTemplateLineItem[] {
  const padded = [...items];
  while (padded.length < minRows) {
    padded.push({
      unitLabel: "",
      description: "",
      amount: null,
      isPrimary: false,
    });
  }
  return padded;
}

export function buildRepairBillingPreview(
  repairs: RepairBillingRepairRecord[],
  catalog: DiagnosisPriceEntry[] = []
): {
  billingStatementItems: RepairBillingPreviewItem[];
  jobOrderItems: RepairBillingPreviewItem[];
} {
  const billingStatementItems = buildBillingStatementLineItems(repairs).map((item, index) => ({
    ...item,
    key: `billing-${item.repairId ?? index}`,
  }));

  const jobOrderItems = buildJobOrderLineItems(repairs, catalog).map((item, index) => ({
    ...item,
    key: `job-${item.repairId ?? "x"}-${index}`,
  }));

  return { billingStatementItems, jobOrderItems };
}

export function syncBillingTotalsFromJobOrder(
  billingItems: RepairBillingPreviewItem[],
  jobOrderItems: RepairBillingPreviewItem[]
): RepairBillingPreviewItem[] {
  const totalsByRepair = new Map<string, number>();
  for (const item of jobOrderItems) {
    if (!item.repairId || item.amount == null) continue;
    totalsByRepair.set(
      item.repairId,
      (totalsByRepair.get(item.repairId) ?? 0) + item.amount
    );
  }

  return billingItems.map((item) => {
    if (!item.repairId) return item;
    const total = totalsByRepair.get(item.repairId);
    if (total == null) return item;
    return { ...item, amount: total };
  });
}

export function sanitizeBillingLineItems(items: unknown[]): RepairTemplateLineItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const item = raw as Partial<RepairTemplateLineItem>;
    const amountRaw = item.amount;
    const amount =
      amountRaw == null
        ? null
        : Number.isFinite(Number(amountRaw))
          ? Number(amountRaw)
          : null;
    return {
      unitLabel: String(item.unitLabel ?? ""),
      description: String(item.description ?? ""),
      amount,
      isPrimary: Boolean(item.isPrimary),
      repairId: item.repairId ? String(item.repairId) : undefined,
    };
  });
}
