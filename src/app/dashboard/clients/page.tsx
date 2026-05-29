import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CsvImportClients } from "@/components/csv-import";
import { createClient } from "@/actions/clients";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: { user: { select: { email: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-slate-500">{clients.length} total</p>
        </div>
      </div>

      <CsvImportClients />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Add client</CardTitle>
          <form action={createClient} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" />
            </div>
            <div>
              <Label htmlFor="company">Company</Label>
              <Input id="company" name="company" />
            </div>
            <Button type="submit">Save client</Button>
          </form>
        </Card>

        <Card className="lg:col-span-1">
          <CardTitle>All clients</CardTitle>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Portal</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50">
                    <td className="py-3 pr-4 font-medium">{c.name}</td>
                    <td className="py-3 pr-4">
                      {c.user ? (
                        <Badge color="green">Active</Badge>
                      ) : (
                        <Badge color="slate">None</Badge>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/dashboard/clients/${c.id}`}
                        className="text-brand-600 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
