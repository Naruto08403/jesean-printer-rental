import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  generateRepairBillingPdf,
  prepareRepairBillingStatement,
  repairBillingFilename,
  repairCustomerDisplayName,
} from "@/lib/repair-billing";

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const clientId = String(body.clientId ?? "").trim() || null;
    const repairIds = Array.isArray(body.repairIds)
      ? body.repairIds.map((id: unknown) => String(id)).filter(Boolean)
      : [];
    const issueDateRaw = String(body.issueDate ?? "");

    if (!clientId && repairIds.length === 0) {
      return NextResponse.json({ error: "Select a client or repair jobs" }, { status: 400 });
    }
    if (!issueDateRaw) {
      return NextResponse.json({ error: "Issue date is required" }, { status: 400 });
    }

    const issueDate = new Date(issueDateRaw);
    if (Number.isNaN(issueDate.getTime())) {
      return NextResponse.json({ error: "Invalid issue date" }, { status: 400 });
    }

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
      include: { payments: true, client: true, printer: true },
      orderBy: { receivedAt: "asc" },
    });

    if (repairs.length === 0) {
      return NextResponse.json({ error: "No billable repair jobs found" }, { status: 404 });
    }

    if (clientId && repairs.some((r) => r.clientId !== clientId)) {
      return NextResponse.json({ error: "All selected jobs must belong to the same client" }, { status: 400 });
    }

    const clientName =
      repairs[0].client?.name ?? repairCustomerDisplayName(repairs[0]);

    const statement = prepareRepairBillingStatement({
      clientName,
      issueDate,
      repairs,
    });

    const buffer = await generateRepairBillingPdf(statement);
    const filename = repairBillingFilename(clientName, issueDate);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate billing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
