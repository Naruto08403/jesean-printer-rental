"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_REPAIR_DIAGNOSES } from "@/lib/repair-diagnosis-catalog";

const REVALIDATE_PATHS = ["/dashboard/repairs", "/dashboard/repairs/diagnoses"];

function revalidateDiagnosisPaths() {
  for (const path of REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

export async function ensureDefaultRepairDiagnoses() {
  const count = await prisma.repairDiagnosisOption.count();
  if (count > 0) return;

  await prisma.repairDiagnosisOption.createMany({
    data: DEFAULT_REPAIR_DIAGNOSES.map((item) => ({
      name: item.name,
      price: item.price,
      sortOrder: item.sortOrder,
      isActive: true,
    })),
  });
}

export async function listRepairDiagnosisOptions(includeInactive = false) {
  await requireAdmin();
  await ensureDefaultRepairDiagnoses();

  return prisma.repairDiagnosisOption.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function listActiveRepairDiagnosisCatalog() {
  await ensureDefaultRepairDiagnoses();
  const rows = await prisma.repairDiagnosisOption.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, price: true },
  });
  return rows;
}

export async function createRepairDiagnosisOption(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") || "").trim();
  const priceRaw = String(formData.get("price") || "").trim();
  const sortOrderRaw = String(formData.get("sortOrder") || "").trim();
  const price = priceRaw ? Number(priceRaw) : 0;
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : 0;

  if (!name) throw new Error("Diagnosis name is required");
  if (!Number.isFinite(price) || price < 0) throw new Error("Invalid price");
  if (!Number.isFinite(sortOrder)) throw new Error("Invalid sort order");

  await prisma.repairDiagnosisOption.create({
    data: { name, price, sortOrder, isActive: true },
  });

  revalidateDiagnosisPaths();
}

export async function updateRepairDiagnosisOption(id: string, formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") || "").trim();
  const priceRaw = String(formData.get("price") || "").trim();
  const sortOrderRaw = String(formData.get("sortOrder") || "").trim();
  const isActive = formData.get("isActive") === "on" || formData.get("isActive") === "true";
  const price = priceRaw ? Number(priceRaw) : 0;
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : 0;

  if (!name) throw new Error("Diagnosis name is required");
  if (!Number.isFinite(price) || price < 0) throw new Error("Invalid price");
  if (!Number.isFinite(sortOrder)) throw new Error("Invalid sort order");

  await prisma.repairDiagnosisOption.update({
    where: { id },
    data: { name, price, sortOrder, isActive },
  });

  revalidateDiagnosisPaths();
}

export async function deleteRepairDiagnosisOption(id: string) {
  await requireAdmin();
  await prisma.repairDiagnosisOption.delete({ where: { id } });
  revalidateDiagnosisPaths();
}

export async function resolveRepairDiagnosisPricing(input: {
  diagnosisRaw: string | null;
  chargeWaived: boolean;
}) {
  const catalog = await listActiveRepairDiagnosisCatalog();
  const selected = input.diagnosisRaw
    ? input.diagnosisRaw
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    : [];

  if (input.chargeWaived) {
    return {
      diagnosis: selected.length > 0 ? selected.join(", ") : null,
      totalAmount: 0,
    };
  }

  const byName = new Map(catalog.map((entry) => [entry.name.trim().toLowerCase(), entry]));
  let total = 0;
  const matched: string[] = [];
  const unknown: string[] = [];

  for (const name of selected) {
    const entry = byName.get(name.toLowerCase());
    if (!entry) {
      unknown.push(name);
      continue;
    }
    matched.push(entry.name);
    total += entry.price;
  }

  if (unknown.length > 0) {
    throw new Error(`Unknown diagnosis: ${unknown.join(", ")}`);
  }

  return {
    diagnosis: matched.length > 0 ? matched.join(", ") : null,
    totalAmount: total,
  };
}
