import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDeliveryReceiptPdf } from "@/lib/delivery-receipt-pdf";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // const sale = await prisma.sale.findUnique({
    //   where: { id },
    //   include: {
    //     client: true,
    //     lines: true,
    //   },
    // });

    
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        client: true,
        lines: {
          include: {
            product: true,
          },
          orderBy: [
            {
              product: {
                model: "asc",
              },
            },
            {
              product: {
                color: "asc",
              },
            },
          ],
        },
      },
    });
    if (!sale) {
      return NextResponse.json(
        { error: "Sale not found" },
        { status: 404 }
      );
    }

    const pdf = await generateDeliveryReceiptPdf(sale);

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="delivery-receipt-${sale.id}.pdf`,
      },
    });
  } catch (err) {
    console.error(err);

    return new NextResponse(String(err), {
      status: 500,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }
}