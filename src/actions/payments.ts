"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { unpaidBillableMonths } from "@/lib/rental-annual";
import {
  groupRentalPaymentRecords,
  paymentsShareBulkCluster,
  type RawRentalPayment,
  type RentalPaymentRecordGroup,
} from "@/lib/rental-payment-records";

type PaymentTarget =
  | { type: "rental"; id: string }
  | { type: "repair"; id: string }
  | { type: "sale"; id: string }
  | { type: "cctv"; id: string };

function revalidateAfterRentalPaymentChange(rentalIds: string[]) {
  revalidatePath("/dashboard/rentals");
  revalidatePath("/dashboard");
  revalidatePath("/portal");
  for (const rentalId of rentalIds) {
    revalidatePath(`/dashboard/rentals/${rentalId}`);
  }
}

/** Delete full bulk batch (all units / months from one Add payment). */
async function expandRentalPaymentDeleteIds(paymentIds: string[]): Promise<string[]> {
  const seeds = await prisma.payment.findMany({
    where: { id: { in: paymentIds }, rentalId: { not: null } },
    include: { rental: { select: { clientId: true } } },
  });
  if (seeds.length === 0) return [];

  const batchIds = [...new Set(seeds.map((s) => s.batchId).filter(Boolean))] as string[];
  if (batchIds.length > 0) {
    const rows = await prisma.payment.findMany({
      where: { batchId: { in: batchIds }, rentalId: { not: null } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  const clientIds = [...new Set(seeds.map((s) => s.rental!.clientId))];
  const all = await prisma.payment.findMany({
    where: { rental: { clientId: { in: clientIds } }, rentalId: { not: null } },
  });

  const raw: RawRentalPayment[] = all.map((p) => ({
    id: p.id,
    amount: p.amount,
    paidAt: p.paidAt,
    billingYear: p.billingYear,
    billingMonth: p.billingMonth,
    batchId: p.batchId,
    method: p.method,
    reference: p.reference,
    notes: p.notes,
    createdAt: p.createdAt,
    rentalId: p.rentalId,
  }));

  const seedRaw = raw.filter((p) => paymentIds.includes(p.id));
  const ids = new Set<string>();
  for (const seed of seedRaw) {
    for (const p of raw) {
      if (paymentsShareBulkCluster(seed, p)) ids.add(p.id);
    }
  }
  return [...ids];
}

export async function addBulkRentalPayments(formData: FormData) {
  await requireAdmin();

  const clientId = String(formData.get("clientId") || "").trim();
  const amount = Number(formData.get("amount"));
  const year = Number(formData.get("year"));
  const startMonth = Number(formData.get("startMonth"));
  const endMonth = Number(formData.get("endMonth"));
  const method = String(formData.get("method") || "").trim() || null;
  const reference = String(formData.get("reference") || "").trim() || null;
  const notesRaw = String(formData.get("notes") || "").trim();
  const vatPercent = Number(formData.get("vatPercent") || 0);
  const vatNote =
    vatPercent > 0 && vatPercent <= 100 ? `VAT ${vatPercent}% withheld` : null;
  const notes = [notesRaw, vatNote].filter(Boolean).join(" · ") || null;
  const recordDateRaw = String(formData.get("recordDate") || "").trim();
  const recordDate = recordDateRaw ? new Date(recordDateRaw) : new Date();

  if (!clientId) throw new Error("Select a client");
  if (!amount || amount <= 0) throw new Error("Enter a valid amount");
  if (Number.isNaN(recordDate.getTime())) throw new Error("Invalid payment date");
  if (!Number.isInteger(year) || year < 2020) throw new Error("Invalid year");
  if (!Number.isInteger(startMonth) || startMonth < 0 || startMonth > 11) {
    throw new Error("Invalid start month");
  }
  if (!Number.isInteger(endMonth) || endMonth < 0 || endMonth > 11) {
    throw new Error("Invalid end month");
  }
  if (endMonth < startMonth) throw new Error("End month must be on or after start month");

  recordDate.setHours(12, 0, 0, 0);

  const rentals = await prisma.rental.findMany({
    where: { clientId, status: { not: "CANCELLED" } },
    include: { payments: true, printer: true },
  });

  if (rentals.length === 0) {
    throw new Error("No rentals found for this client");
  }

  const batchId = randomUUID();
  const paymentRows: {
    rentalId: string;
    amount: number;
    paidAt: Date;
    billingYear: number;
    billingMonth: number;
    batchId: string;
    method: string | null;
    reference: string | null;
    notes: string | null;
  }[] = [];

  const payableForRental = (rental: (typeof rentals)[number]) =>
    rental.printer?.price ?? rental.ratePerPeriod;

  const round2 = (value: number) => Math.round(value * 100) / 100;

  for (let month = startMonth; month <= endMonth; month++) {
    const eligible = rentals
      .map((rental) => {
        const billingRental = {
          id: rental.id,
          status: rental.status,
          startDate: rental.startDate,
          endDate: rental.endDate,
          ratePerPeriod: rental.ratePerPeriod,
          paymentSchedule: rental.paymentSchedule,
          printer: rental.printer
            ? {
                brand: rental.printer.brand,
                model: rental.printer.model,
                serialNumber: rental.printer.serialNumber,
                price: rental.printer.price,
              }
            : null,
          payments: rental.payments.map((p) => ({
            amount: p.amount,
            paidAt: p.paidAt,
            billingYear: p.billingYear,
            billingMonth: p.billingMonth,
          })),
        };
        const baseAmount = payableForRental(rental);
        const unpaid = unpaidBillableMonths(billingRental, year, month, month);
        if (unpaid.length === 0) return null;
        return { rentalId: rental.id, baseAmount };
      })
      .filter((entry): entry is { rentalId: string; baseAmount: number } => entry != null);

    if (eligible.length === 0) continue;

    const baseTotal = eligible.reduce((sum, row) => sum + row.baseAmount, 0);
    let allocated = 0;
    for (let i = 0; i < eligible.length; i++) {
      const row = eligible[i];
      const rowAmount =
        i === eligible.length - 1
          ? round2(amount - allocated)
          : round2((amount * row.baseAmount) / (baseTotal || eligible.length));
      allocated += rowAmount;
      paymentRows.push({
        rentalId: row.rentalId,
        amount: rowAmount,
        paidAt: new Date(year, month + 1, 0, 12, 0, 0, 0),
        billingYear: year,
        billingMonth: month,
        batchId,
        method,
        reference,
        notes,
      });
    }
  }

  if (paymentRows.length === 0) {
    throw new Error(
      "No unpaid months in that range. If you deleted a payment, use Payment records → Delete (removes the full batch), then refresh the rentals page before adding again."
    );
  }

  await prisma.$transaction(
    paymentRows.map((row) =>
      prisma.payment.create({
        data: {
          rentalId: row.rentalId,
          amount: row.amount,
          paidAt: row.paidAt,
          billingYear: row.billingYear,
          billingMonth: row.billingMonth,
          batchId: row.batchId,
          method: row.method,
          reference: row.reference,
          notes: row.notes,
          createdAt: recordDate,
        },
      })
    )
  );

  revalidateAfterRentalPaymentChange(rentals.map((r) => r.id));

  return { count: paymentRows.length };
}

export async function getRentalPaymentRecords(
  clientId: string,
  year: number
): Promise<RentalPaymentRecordGroup[]> {
  await requireAdmin();

  if (!clientId) return [];
  if (!Number.isInteger(year) || year < 2020) return [];

  const payments = await prisma.payment.findMany({
    where: {
      rentalId: { not: null },
      rental: { clientId },
      OR: [
        { billingYear: year },
        {
          billingYear: null,
          paidAt: {
            gte: new Date(year, 0, 1),
            lte: new Date(year, 11, 31, 23, 59, 59, 999),
          },
        },
      ],
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
  });

  return groupRentalPaymentRecords(payments, year);
}

export async function updateRentalPaymentGroup(formData: FormData) {
  await requireAdmin();

  const paymentIdsRaw = String(formData.get("paymentIds") || "");
  const paymentIds = paymentIdsRaw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (paymentIds.length === 0) throw new Error("No payments selected");

  const reference = String(formData.get("reference") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const method = String(formData.get("method") || "").trim() || null;
  const paidAtRaw = String(formData.get("paidAt") || "").trim();

  const recordDate = paidAtRaw ? new Date(paidAtRaw) : null;
  if (recordDate && Number.isNaN(recordDate.getTime())) {
    throw new Error("Invalid payment date");
  }
  if (recordDate) recordDate.setHours(12, 0, 0, 0);

  const existing = await prisma.payment.findMany({
    where: { id: { in: paymentIds }, rentalId: { not: null } },
    include: { rental: { include: { printer: true } } },
  });

  if (existing.length !== paymentIds.length) {
    throw new Error("Some payment records were not found");
  }

  await prisma.$transaction(
    existing.map((payment) =>
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          amount: payment.rental?.printer?.price ?? payment.rental?.ratePerPeriod ?? payment.amount,
          reference,
          notes,
          method,
          ...(recordDate ? { createdAt: recordDate } : {}),
        },
      })
    )
  );

  revalidateAfterRentalPaymentChange(
    existing.map((p) => p.rentalId).filter((id): id is string => Boolean(id))
  );
}

export async function deleteRentalPaymentGroup(formData: FormData) {
  await requireAdmin();

  const paymentIdsRaw = String(formData.get("paymentIds") || "");
  const paymentIds = paymentIdsRaw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (paymentIds.length === 0) throw new Error("No payments selected");

  const idsToDelete = await expandRentalPaymentDeleteIds(paymentIds);
  if (idsToDelete.length === 0) throw new Error("Some payment records were not found");

  const existing = await prisma.payment.findMany({
    where: { id: { in: idsToDelete }, rentalId: { not: null } },
    select: { rentalId: true },
  });

  await prisma.payment.deleteMany({
    where: { id: { in: idsToDelete } },
  });

  revalidateAfterRentalPaymentChange(
    existing.map((p) => p.rentalId).filter((id): id is string => Boolean(id))
  );

  return { deleted: idsToDelete.length };
}

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
