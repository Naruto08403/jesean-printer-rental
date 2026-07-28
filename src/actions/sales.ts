"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  buildSaleItemsJson,
  formatInventoryProductLabel,
  parseSaleLinesJson,
} from "@/lib/inventory";

export async function createSale(formData: FormData) {
  await requireAdmin();
  const clientId = String(formData.get("clientId") || "") || null;
  const linesRaw = String(formData.get("lines") || "");
  const notes = String(formData.get("notes") || "").trim() || null;

  const lineInputs = parseSaleLinesJson(linesRaw);
  const productIds = [...new Set(lineInputs.map((line) => line.productId))];

  await prisma.$transaction(async (tx) => {
    const products = await tx.inventoryProduct.findMany({
      where: { id: { in: productIds }, isActive: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));

    const resolvedLines: {
      productId: string;
      name: string;
      qty: number;
      unitPrice: number;
      lineTotal: number;
    }[] = [];

    for (const input of lineInputs) {
      const product = byId.get(input.productId);
      if (!product) throw new Error("One or more products are unavailable");

      const unitPrice = input.unitPrice ?? product.sellPrice;
      if (product.quantity < input.qty) {
        throw new Error(
          `Insufficient stock for ${product.name}. Available: ${product.quantity}`
        );
      }

      resolvedLines.push({
        productId: product.id,
        name: formatInventoryProductLabel(product),
        qty: input.qty,
        unitPrice,
        lineTotal: unitPrice * input.qty,
      });
    }

    const totalAmount = resolvedLines.reduce((sum, line) => sum + line.lineTotal, 0);
    const items = buildSaleItemsJson(
      resolvedLines.map((line) => ({
        name: line.name,
        qty: line.qty,
        price: line.lineTotal,
      }))
    );

    const sale = await tx.sale.create({
      data: {
        clientId,
        items,
        totalAmount,
        notes,
        status: "COMPLETED",
        lines: {
          create: resolvedLines.map((line) => ({
            productId: line.productId,
            name: line.name,
            qty: line.qty,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
          })),
        },
      },
    });

    for (const line of resolvedLines) {
      await tx.inventoryProduct.update({
        where: { id: line.productId },
        data: { quantity: { decrement: line.qty } },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: line.productId,
          type: "SALE",
          quantity: -line.qty,
          saleId: sale.id,
          notes: `Sale ${sale.id.slice(-6)}`,
        },
      });
    }
  });

  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/inventory");
}
