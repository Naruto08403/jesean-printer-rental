import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  billingDownloadFilename,
  generateClientBillingExcel,
  type BillingRentalUnit,
} from "@/lib/rental-billing-excel";

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const clientId = String(body.clientId ?? "");
    const year = Number(body.year);
    const startMonth = Number(body.startMonth);
    const endMonth = Number(body.endMonth);
    const issueDateRaw = String(body.issueDate ?? "");

    if (!clientId) {
      return NextResponse.json({ error: "Client is required" }, { status: 400 });
    }
    if (!Number.isFinite(year) || year < 2000) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }
    if (!Number.isInteger(startMonth) || !Number.isInteger(endMonth)) {
      return NextResponse.json({ error: "Invalid month range" }, { status: 400 });
    }
    if (!issueDateRaw) {
      return NextResponse.json({ error: "Issue date is required" }, { status: 400 });
    }

    const issueDate = new Date(issueDateRaw);
    if (Number.isNaN(issueDate.getTime())) {
      return NextResponse.json({ error: "Invalid issue date" }, { status: 400 });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        rentals: {
          where: { status: { in: ["ACTIVE", "PAUSED"] } },
          include: { printer: true },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const rentals: BillingRentalUnit[] = client.rentals.map((r) => ({
      status: r.status,
      ratePerPeriod: r.ratePerPeriod,
      paymentSchedule: r.paymentSchedule,
      printer: r.printer
        ? {
            brand: r.printer.brand,
            model: r.printer.model,
            status: r.printer.status,
            price: r.printer.price,
          }
        : null,
    }));

    const buffer = await generateClientBillingExcel({
      clientName: client.name,
      issueDate,
      year,
      startMonth,
      endMonth,
      rentals,
    });

    const filename = billingDownloadFilename(client.name, year, startMonth, endMonth);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate billing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
