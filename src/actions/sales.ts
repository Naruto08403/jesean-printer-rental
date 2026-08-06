"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  buildSaleItemsJson,
  formatInventoryProductLabel,
  parseSaleLinesJson,
} from "@/lib/inventory";

export type UpdateSaleInput = {
  clientId: string | null;
  notes: string | null;
  delivery: Date;
  totalAmount: number;
  items: {
    productId: string;
    name: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }[];
};

export async function createSale(formData: FormData) {
  await requireAdmin();
  const clientId = String(formData.get("clientId") || "") || null;
  const linesRaw = String(formData.get("lines") || "");
  const notes = String(formData.get("notes") || "").trim() || null;
  const created = formData.get("createdat")

  const lineInputs = parseSaleLinesJson(linesRaw);
  const productIds = [...new Set(lineInputs.map((line) => line.productId))];
  const deliveryDateValue = String(
    formData.get("deliveryDate") || ""
);

const delivery = deliveryDateValue
    ? new Date(deliveryDateValue)
    : null;

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
        client: clientId
          ? {
              connect: { id: clientId },
            }
          : undefined,
    
        items,
        totalAmount,
        notes,
        status: "COMPLETED",
        delivery: delivery ?? undefined,
    
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

export async function deleteSale(id: string) {
  await prisma.payment.deleteMany({
    where: {
      saleId: id,
    },
  });

  await prisma.sale.delete({
    where: {
      id,
    },
  });

  revalidatePath("/dashboard/sales");
}

export async function updateSale(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id"));
  const clientId = String(formData.get("clientId") || "") || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  const deliveryValue = String(formData.get("deliveryDate") || "");
  const delivery = deliveryValue ? new Date(deliveryValue) : null;

  const linesRaw = String(formData.get("lines") || "");
  const lineInputs = parseSaleLinesJson(linesRaw);

  const productIds = [...new Set(lineInputs.map((l) => l.productId))];

  await prisma.$transaction(async (tx) => {
    //----------------------------------------------------
    // Load existing sale with lines
    //----------------------------------------------------

    const existingSale = await tx.sale.findUnique({
      where: { id },
      include: {
        lines: true,
      },
    });

    if (!existingSale) {
      throw new Error("Sale not found.");
    }

    //----------------------------------------------------
    // Restore previous inventory
    //----------------------------------------------------

    for (const line of existingSale.lines) {
      if (!line.productId) continue;

      await tx.inventoryProduct.update({
        where: {
          id: line.productId,
        },
        data: {
          quantity: {
            increment: line.qty,
          },
        },
      });
    }

    //----------------------------------------------------
    // Remove previous inventory movements
    //----------------------------------------------------

    await tx.inventoryMovement.deleteMany({
      where: {
        saleId: id,
      },
    });

    //----------------------------------------------------
    // Delete previous sale lines
    //----------------------------------------------------

    await tx.saleLine.deleteMany({
      where: {
        saleId: id,
      },
    });

    //----------------------------------------------------
    // Load products again
    //----------------------------------------------------

    const products = await tx.inventoryProduct.findMany({
      where: {
        id: {
          in: productIds,
        },
        isActive: true,
      },
    });

    const byId = new Map(
      products.map((p) => [p.id, p])
    );

    const resolvedLines: {
      productId: string;
      name: string;
      qty: number;
      unitPrice: number;
      lineTotal: number;
    }[] = [];

    //----------------------------------------------------
    // Validate stock
    //----------------------------------------------------

    for (const input of lineInputs) {
      const product = byId.get(input.productId);

      if (!product) {
        throw new Error("Product not found.");
      }

      const unitPrice =
        input.unitPrice ?? product.sellPrice;

      if (product.quantity < input.qty) {
        throw new Error(
          `${product.name} only has ${product.quantity} in stock.`
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

    //----------------------------------------------------
    // Compute totals
    //----------------------------------------------------

    const totalAmount = resolvedLines.reduce(
      (sum, l) => sum + l.lineTotal,
      0
    );

    const items = buildSaleItemsJson(
      resolvedLines.map((l) => ({
        name: l.name,
        qty: l.qty,
        price: l.lineTotal,
      }))
    );

    //----------------------------------------------------
    // Update Sale
    //----------------------------------------------------

    await tx.sale.update({
      where: {
        id,
      },
      data: {
        client: clientId
          ? {
              connect: {
                id: clientId,
              },
            }
          : {
              disconnect: true,
            },

        notes,
        delivery,
        items,
        totalAmount,
      },
    });

    //----------------------------------------------------
    // Create new SaleLines
    //----------------------------------------------------

    await tx.saleLine.createMany({
      data: resolvedLines.map((line) => ({
        saleId: id,
        productId: line.productId,
        name: line.name,
        qty: line.qty,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      })),
    });

    //----------------------------------------------------
    // Deduct inventory again
    //----------------------------------------------------

    for (const line of resolvedLines) {
      await tx.inventoryProduct.update({
        where: {
          id: line.productId,
        },
        data: {
          quantity: {
            decrement: line.qty,
          },
        },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: line.productId,
          type: "SALE",
          quantity: -line.qty,
          saleId: id,
          notes: `Sale ${id.slice(-6)}`,
        },
      });
    }
  });

  revalidatePath("/dashboard/sales");
  revalidatePath(`/dashboard/sales/${id}`);
  revalidatePath("/dashboard/inventory");
}