import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { billingDownloadFilename } from "@/lib/rental-billing-shared";
import { loadClientBillingRentals } from "@/lib/rental-billing-api";
import { billingContentType, generateClientBilling } from "@/lib/rental-billing-generate";

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const clientId = String(body.clientId ?? "");
    const year = Number(body.year);
    const startMonth = Number(body.startMonth);
    const endMonth = Number(body.endMonth);
    const issueDateRaw = String(body.issueDate ?? "");
    const representativeName = String(body.representative ?? "")

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

    const loaded = await loadClientBillingRentals(clientId);
    if (!loaded) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const buffer = await generateClientBilling({
      clientName: loaded.client.name,
      issueDate,
      year,
      startMonth,
      endMonth,
      rentals: loaded.rentals,
      representativeName:representativeName,
    });

    const filename = billingDownloadFilename(
      loaded.client.name,
      year,
      startMonth,
      endMonth,
      "xlsx"
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": billingContentType(),
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate billing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
