"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { unpaidBillableMonths } from "@/lib/rental-annual";
import {
  groupRentalPaymentRecords,
  type RentalPaymentRecordGroup,
} from "@/lib/rental-payment-records";

type PaymentTarget =
  | { type: "rental"; id: string }
  | { type: "repair"; id: string }
  | { type: "sale"; id: string }
  | { type: "cctv"; id: string };

export async function addBulkRentalPayments(formData: FormData) {
  await requireAdmin();

  const clientId = String(formData.get("clientId") || "").trim();
  const amount = Number(formData.get("amount"));
  const year = Number(formData.get("year"));
  const startMonth = Number(formData.get("startMonth"));
  const endMonth = Number(formData.get("endMonth"));
  const method = String(formData.get("method") || "").trim() || null;
  const reference = String(formData.get("reference") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
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

  const paymentRows: {
    rentalId: string;
    amount: number;
    paidAt: Date;
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
          })),
        };
        const baseAmount = payableForRental(rental);
        const unpaid = unpaidBillableMonths(billingRental, year, month, month, baseAmount);
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
        method,
        reference,
        notes,
      });
    }
  }

  if (paymentRows.length === 0) {
    throw new Error("No unpaid billable months in that range");
  }

  await prisma.$transaction(
    paymentRows.map((row) =>
      prisma.payment.create({
        data: {
          rentalId: row.rentalId,
          amount: row.amount,
          paidAt: row.paidAt,
          method: row.method,
          reference: row.reference,
          notes: row.notes,
          createdAt: recordDate,
        },
      })
    )
  );

  revalidatePath("/dashboard/rentals");
  revalidatePath("/dashboard");
  revalidatePath("/portal");
  for (const rental of rentals) {
    revalidatePath(`/dashboard/rentals/${rental.id}`);
  }

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
      paidAt: {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31, 23, 59, 59, 999),
      },
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

  revalidatePath("/dashboard/rentals");
  revalidatePath("/dashboard");
  revalidatePath("/portal");
  for (const payment of existing) {
    if (payment.rentalId) {
      revalidatePath(`/dashboard/rentals/${payment.rentalId}`);
    }
  }
}

export async function deleteRentalPaymentGroup(formData: FormData) {
  await requireAdmin();

  const paymentIdsRaw = String(formData.get("paymentIds") || "");
  const paymentIds = paymentIdsRaw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (paymentIds.length === 0) throw new Error("No payments selected");

  const existing = await prisma.payment.findMany({
    where: { id: { in: paymentIds }, rentalId: { not: null } },
  });
  if (existing.length !== paymentIds.length) {
    throw new Error("Some payment records were not found");
  }

  await prisma.payment.deleteMany({
    where: { id: { in: paymentIds } },
  });

  revalidatePath("/dashboard/rentals");
  revalidatePath("/dashboard");
  revalidatePath("/portal");
  for (const payment of existing) {
    if (payment.rentalId) {
      revalidatePath(`/dashboard/rentals/${payment.rentalId}`);
    }
  }
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
