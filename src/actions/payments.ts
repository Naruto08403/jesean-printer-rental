"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

type PaymentTarget =
  | { type: "rental"; id: string }
  | { type: "repair"; id: string }
  | { type: "sale"; id: string }
  | { type: "cctv"; id: string };

export async function addPayment(target: PaymentTarget, formData: FormData) {
  await requireAdmin();
  const amount = Number(formData.get("amount"));
  const method = String(formData.get("method") || "").trim() || null;
  const reference = String(formData.get("reference") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const paidAt = formData.get("paidAt")
    ? new Date(String(formData.get("paidAt")))
    : new Date();

  if (!amount || amount <= 0) throw new Error("Invalid amount");

  const data = {
    amount,
    method,
    reference,
    notes,
    paidAt,
    rentalId: target.type === "rental" ? target.id : null,
    repairId: target.type === "repair" ? target.id : null,
    saleId: target.type === "sale" ? target.id : null,
    cctvInstallationId: target.type === "cctv" ? target.id : null,
  };

  await prisma.payment.create({ data });

  const paths: Record<PaymentTarget["type"], string> = {
    rental: `/dashboard/rentals/${target.id}`,
    repair: `/dashboard/repairs/${target.id}`,
    sale: `/dashboard/sales/${target.id}`,
    cctv: `/dashboard/cctv/${target.id}`,
  };
  revalidatePath(paths[target.type]);
  revalidatePath("/dashboard");
  revalidatePath("/portal");
}
