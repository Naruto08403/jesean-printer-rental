import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { listActiveRepairDiagnosisCatalog } from "@/actions/repair-diagnoses";
import { buildRepairBillingPreview } from "@/lib/repair-billing-lines";
import { toRepairBillingRecord } from "@/lib/repair-billing-record";
import { repairCustomerDisplayName } from "@/lib/repair-billing";

async function loadBillableRepairs(clientId: string | null, repairIds: string[]) {
  const repairs = await prisma.repair.findMany({
    where: {
      isChargeWaived: false,
      totalAmount: { gt: 0 },
      status: { not: "CANCELLED" },
      ...(repairIds.length > 0
        ? { id: { in: repairIds } }
        : clientId
          ? { clientId }
          : {}),
    },
    include: {
      payments: true,
      client: true,
      printer: true,
      diagnosisLines: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { receivedAt: "asc" },
  });

  if (repairs.length === 0) {
    throw new Error("No billable repair jobs found");
  }

  if (clientId && repairs.some((r) => r.clientId !== clientId)) {
    throw new Error("All selected jobs must belong to the same client");
  }

  return repairs;
}

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const clientId = String(body.clientId ?? "").trim() || null;
    const repairIds = Array.isArray(body.repairIds)
      ? body.repairIds.map((id: unknown) => String(id)).filter(Boolean)
      : [];

    if (!clientId && repairIds.length === 0) {
      return NextResponse.json({ error: "Select a client or repair jobs" }, { status: 400 });
    }

    const repairs = await loadBillableRepairs(clientId, repairIds);
    const clientName = repairs[0].client?.name ?? repairCustomerDisplayName(repairs[0]);
    const catalog = await listActiveRepairDiagnosisCatalog();

    const repairRecords = repairs.map(toRepairBillingRecord);

    const preview = buildRepairBillingPreview(repairRecords, catalog);

    return NextResponse.json({
      clientName,
      billingStatementItems: preview.billingStatementItems,
      jobOrderItems: preview.jobOrderItems,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load preview";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
