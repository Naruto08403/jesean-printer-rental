"use server";

import { revalidatePath } from "next/cache";
import type { InventoryCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const REVALIDATE_PATHS = ["/dashboard/inventory", "/dashboard/sales"];

function revalidateInventoryPaths() {
  for (const path of REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

function parseCategory(value: string): InventoryCategory {
  const allowed: InventoryCategory[] = [
    "PRINTER",
    "INK",
    "CCTV",
    "CPU",
    "PRINTER_PART",
    "OTHER",
  ];
  if (!allowed.includes(value as InventoryCategory)) {
    throw new Error("Invalid category");
  }
  return value as InventoryCategory;
}

export async function listInventoryProducts(includeInactive = false) {
  await requireAdmin();
  return prisma.inventoryProduct.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

export async function listActiveInventoryForSale() {
  await requireAdmin();
  return prisma.inventoryProduct.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      sku: true,
      category: true,
      partType: true,
      brand: true,
      model: true,
      quantity: true,
      sellPrice: true,
      color:true,
    },
  });
}

export async function createInventoryProduct(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") || "").trim();
  const category = parseCategory(String(formData.get("category") || ""));
  const partType = String(formData.get("partType") || "").trim() || null;
  const sku = String(formData.get("sku") || "").trim() || null;
  const brand = String(formData.get("brand") || "").trim() || null;
  const model = String(formData.get("model") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const quantity = Number(formData.get("quantity") || 0);
  const sellPrice = Number(formData.get("sellPrice") || 0);
  const costPriceRaw = String(formData.get("costPrice") || "").trim();
  const reorderAtRaw = String(formData.get("reorderAt") || "").trim();
  const costPrice = costPriceRaw ? Number(costPriceRaw) : null;
  const reorderAt = reorderAtRaw ? Number(reorderAtRaw) : null;
  const color  = String(formData.get("color") || "").trim() || null;

  if (!name) throw new Error("Product name is required");
  if (!Number.isFinite(quantity) || quantity < 0 || !Number.isInteger(quantity)) {
    throw new Error("Invalid starting quantity");
  }
  if (!Number.isFinite(sellPrice) || sellPrice < 0) throw new Error("Invalid sell price");
  if (costPrice != null && (!Number.isFinite(costPrice) || costPrice < 0)) {
    throw new Error("Invalid cost price");
  }
  if (reorderAt != null && (!Number.isFinite(reorderAt) || reorderAt < 0 || !Number.isInteger(reorderAt))) {
    throw new Error("Invalid reorder level");
  }

  await prisma.inventoryProduct.create({
    data: {
      name,
      category,
      partType: category === "PRINTER_PART" ? partType : null,
      sku,
      brand,
      model,
      notes,
      quantity,
      sellPrice,
      costPrice,
      reorderAt,
      color,
      isActive: true,
    },
  });

  revalidateInventoryPaths();
}

export async function updateInventoryProduct(id: string, formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") || "").trim();
  const category = parseCategory(String(formData.get("category") || ""));
  const partType = String(formData.get("partType") || "").trim() || null;
  const sku = String(formData.get("sku") || "").trim() || null;
  const brand = String(formData.get("brand") || "").trim() || null;
  const model = String(formData.get("model") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const sellPrice = Number(formData.get("sellPrice") || 0);
  const costPriceRaw = String(formData.get("costPrice") || "").trim();
  const reorderAtRaw = String(formData.get("reorderAt") || "").trim();
  const isActive = formData.get("isActive") === "on" || formData.get("isActive") === "true";
  const costPrice = costPriceRaw ? Number(costPriceRaw) : null;
  const reorderAt = reorderAtRaw ? Number(reorderAtRaw) : null;
  const color  = String(formData.get("color") || "").trim() || null;

  if (!name) throw new Error("Product name is required");
  if (!Number.isFinite(sellPrice) || sellPrice < 0) throw new Error("Invalid sell price");
  if (costPrice != null && (!Number.isFinite(costPrice) || costPrice < 0)) {
    throw new Error("Invalid cost price");
  }
  if (reorderAt != null && (!Number.isFinite(reorderAt) || reorderAt < 0 || !Number.isInteger(reorderAt))) {
    throw new Error("Invalid reorder level");
  }

  await prisma.inventoryProduct.update({
    where: { id },
    data: {
      name,
      category,
      partType: category === "PRINTER_PART" ? partType : null,
      sku,
      brand,
      model,
      notes,
      sellPrice,
      costPrice,
      reorderAt,
      color,
      isActive,
    },
  });

  revalidateInventoryPaths();
}

export async function adjustInventoryStock(id: string, formData: FormData) {
  await requireAdmin();

  const delta = Number(formData.get("delta"));
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!Number.isFinite(delta) || delta === 0 || !Number.isInteger(delta)) {
    throw new Error("Enter a non-zero whole number (+ to add, − to remove)");
  }

  await prisma.$transaction(async (tx) => {
    const product = await tx.inventoryProduct.findUnique({ where: { id } });
    if (!product) throw new Error("Product not found");

    const nextQty = product.quantity + delta;
    if (nextQty < 0) {
      throw new Error(`Not enough stock. Current quantity: ${product.quantity}`);
    }

    await tx.inventoryProduct.update({
      where: { id },
      data: { quantity: nextQty },
    });

    await tx.inventoryMovement.create({
      data: {
        productId: id,
        type: delta > 0 ? "RESTOCK" : "ADJUSTMENT",
        quantity: delta,
        notes,
      },
    });
  });

  revalidateInventoryPaths();
}


export async function deleteInventory(id: string) {
  await prisma.inventoryProduct.deleteMany({
    where: {
      id: id,
    },
  });

 

  revalidatePath("/dashboard/inventory");
}
