import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  generateRepairBillingPdf,
  generateRepairBillingDocx,
  prepareRepairBillingStatement,
  repairBillingFilename,
  repairCustomerDisplayName,
} from "@/lib/repair-billing";
import { sanitizeBillingLineItems } from "@/lib/repair-billing-lines";

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
      include: {
        payments: true,
        client: true,
        printer: true,
        diagnosisLines: { orderBy: { sortOrder: "asc" } },
      },
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

    const billingStatementItems = sanitizeBillingLineItems(body.billingStatementItems);
    const jobOrderItems = sanitizeBillingLineItems(body.jobOrderItems);
    const format =
  String(body.format ?? "pdf").toLowerCase() === "docx"
    ? "docx"
    : "pdf";
    // const buffer = await generateRepairBillingPdf({
    //   ...statement,
    //   ...(billingStatementItems.length > 0 ? { billingStatementItems } : {}),
    //   ...(jobOrderItems.length > 0 ? { jobOrderItems } : {}),
    // });
    const payload = {
      ...statement,
      ...(billingStatementItems.length > 0 ? { billingStatementItems } : {}),
      ...(jobOrderItems.length > 0 ? { jobOrderItems } : {}),
    };
    
    const buffer =
      format === "docx"
        ? await generateRepairBillingDocx(payload)
        : await generateRepairBillingPdf(payload);
    
    const baseFilename = repairBillingFilename(clientName, issueDate).replace(
      /\.pdf$/i,
      ""
    );
    
    const filename =
      format === "docx"
        ? `${baseFilename}.docx`
        : `${baseFilename}.pdf`;
    
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          format === "docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
    
    // return new NextResponse(new Uint8Array(buffer), {
    //   headers: {
    //     "Content-Type": "application/pdf",
    //     "Content-Disposition": `attachment; filename="${filename}"`,
    //   },
    // });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate billing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
