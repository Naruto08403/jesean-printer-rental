import { prisma } from "@/lib/prisma";
import { createPrinter } from "@/actions/printers";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const statusColor: Record<string, "green" | "amber" | "blue" | "slate"> = {
  AVAILABLE: "green",
  RENTED: "blue",
  IN_REPAIR: "amber",
  RETIRED: "slate",
};

export default async function PrintersPage() {
  const printers = await prisma.printer.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { rentals: true, repairs: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Printers</h1>

      <Card>
        <CardTitle>Add printer</CardTitle>
        <form action={createPrinter} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="serialNumber">Serial number</Label>
            <Input id="serialNumber" name="serialNumber" />
          </div>
          <div>
            <Label htmlFor="brand">Brand</Label>
            <Input id="brand" name="brand" />
          </div>
          <div>
            <Label htmlFor="model">Model</Label>
            <Input id="model" name="model" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Add printer</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Inventory</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-2">Unit</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">History</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {printers.map((p) => (
                <tr key={p.id} className="border-b border-slate-50">
                  <td className="py-3">
                    <p className="font-medium">
                      {[p.brand, p.model].filter(Boolean).join(" ") || "Printer"}
                    </p>
                    <p className="text-slate-500">{p.serialNumber ?? "No serial"}</p>
                  </td>
                  <td className="py-3">
                    <Badge color={statusColor[p.status]}>{p.status.replace("_", " ")}</Badge>
                  </td>
                  <td className="py-3 text-slate-600">
                    {p._count.rentals} rentals · {p._count.repairs} repairs
                  </td>
                  <td className="py-3 text-right">
                    <Link href={`/dashboard/printers/${p.id}`} className="text-brand-600">
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
