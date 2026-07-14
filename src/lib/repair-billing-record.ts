import type { RepairBillingRepairRecord } from "@/lib/repair-billing-lines";

type RepairWithLines = {
  id: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  problem: string;
  diagnosis: string | null;
  totalAmount: number;
  pricingMode?: "CATALOG" | "GENERAL";
  printer?: { brand: string | null; model: string | null; serialNumber: string | null } | null;
  diagnosisLines?: { name: string; price: number; sortOrder?: number }[];
};

export function toRepairBillingRecord(repair: RepairWithLines): RepairBillingRepairRecord {
  const lines = (repair.diagnosisLines ?? [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((line) => ({ name: line.name, price: line.price }));

  return {
    id: repair.id,
    brand: repair.brand,
    model: repair.model,
    serialNumber: repair.serialNumber,
    problem: repair.problem,
    diagnosis: repair.diagnosis,
    totalAmount: repair.totalAmount,
    pricingMode: repair.pricingMode,
    diagnosisLines: lines.length > 0 ? lines : undefined,
    printer: repair.printer,
  };
}
