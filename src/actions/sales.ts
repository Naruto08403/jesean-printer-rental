"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function createSale(formData: FormData) {
  await requireAdmin();
  const clientId = String(formData.get("clientId") || "") || null;
  const itemsRaw = String(formData.get("items"));
  const totalAmount = Number(formData.get("totalAmount"));
  const notes = String(formData.get("notes") || "").trim() || null;

  let items = itemsRaw;
  try {
    JSON.parse(itemsRaw);
  } catch {
    items = JSON.stringify([
      { name: itemsRaw, qty: 1, price: totalAmount },
    ]);
  }

  await prisma.sale.create({
    data: {
      clientId,
      items,
      totalAmount,
      notes,
      status: "COMPLETED",
    },
  });

  revalidatePath("/dashboard/sales");
}
