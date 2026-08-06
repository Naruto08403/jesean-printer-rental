import type { InventoryCategory } from "@prisma/client";

export const INVENTORY_CATEGORY_LABELS: Record<InventoryCategory, string> = {
  PRINTER: "Printer",
  INK: "Printer ink",
  CCTV: "CCTV",
  CPU: "CPU",
  PRINTER_PART: "Printer part",
  OTHER: "Other",
};

export const PRINTER_PART_TYPES = [
  "Flex",
  "Assembly",
  "Board",
  "Fuser",
  "Drum",
  "Other",
] as const;

export type SaleLineInput = {
  productId: string;
  qty: number;
  unitPrice?: number;
};

export function formatInventoryProductLabel(product: {
  name: string;
  brand?: string | null;
  model?: string | null;
  sku?: string | null;
  color?: string | null;
}) {
  const parts = [product.name];
  // if (product.brand ) parts.push(product.brand);
  if (product.model) parts.push(product.model);
  if (product.color) parts.push(`(${product.color})`);
  return parts.join(" · ");
}

export function parseSaleLinesJson(raw: string): SaleLineInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid sale lines");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Add at least one product");
  }

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Invalid line ${index + 1}`);
    }
    const row = entry as Record<string, unknown>;
    const productId = String(row.productId || "").trim();
    const qty = Number(row.qty);
    const unitPrice =
      row.unitPrice != null && row.unitPrice !== ""
        ? Number(row.unitPrice)
        : undefined;

    if (!productId) throw new Error(`Line ${index + 1}: product is required`);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
      throw new Error(`Line ${index + 1}: quantity must be a whole number greater than 0`);
    }
    if (unitPrice != null && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
      throw new Error(`Line ${index + 1}: invalid price`);
    }

    return { productId, qty, unitPrice };
  });
}

export function buildSaleItemsJson(
  lines: { name: string; qty: number; price: number }[]
) {
  return JSON.stringify(
    lines.map((line) => ({
      name: line.qty > 1 ? `${line.name} x${line.qty}` : line.name,
      qty: line.qty,
      price: line.price,
    }))
  );
}
