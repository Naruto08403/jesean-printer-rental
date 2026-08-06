import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DeliveryReceipt } from "@/components/print/delivery-receipt";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PrintSalePage({ params }: Props) {
  const { id } = await params;

  const sale = await prisma.sale.findUnique({
    where: {
      id,
    },
    include: {
      client: true,
      lines: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!sale) {
    notFound();
  }

  return (
    <div className="bg-gray-100 min-h-screen py-8">
      <DeliveryReceipt sale={sale} />
    </div>
  );
}