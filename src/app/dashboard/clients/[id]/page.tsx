import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { updateClient, createClientPortalLogin } from "@/actions/clients";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { repairDisplayTitle } from "@/lib/repair-device";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      user: true,
      rentals: { take: 5, orderBy: { createdAt: "desc" } },
      repairs: { take: 5, orderBy: { createdAt: "desc" } },
    },
  });
  if (!client) notFound();

  const update = updateClient.bind(null, id);
  const createLogin = createClientPortalLogin.bind(null, id);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/clients" className="text-sm text-brand-600 hover:underline">
        ← Clients
      </Link>
      <h1 className="text-2xl font-bold">{client.name}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Edit client</CardTitle>
          <form action={update} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" defaultValue={client.name} required />
            </div>
            <div>
              <Label htmlFor="status">Status *</Label>
              <Select
                id="status"
                name="status"
                defaultValue={client.status}
              >
                <option value="ACTIVE">Active</option>
                <option value="STOPPED">Stop (vacation / no classes)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={client.email ?? ""} />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={client.phone ?? ""} />
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input id="address" name="address" defaultValue={client.address ?? ""} />
            </div>
            <Button type="submit">Update</Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Client portal login</CardTitle>
          {client.user ? (
            <p className="mt-2 text-sm text-slate-600">
              Portal active · username: <strong>{client.user.username}</strong>
            </p>
          ) : (
            <form action={createLogin} className="mt-4 space-y-3">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  required
                  minLength={3}
                  maxLength={32}
                  autoCapitalize="none"
                  placeholder="e.g. acme_corp"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" minLength={6} required />
              </div>
              <Button type="submit">Create portal access</Button>
            </form>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle>Recent activity</CardTitle>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-slate-500">Rentals</p>
            <ul className="mt-2 text-sm">
              {client.rentals.map((r) => (
                <li key={r.id}>
                  <Link href={`/dashboard/rentals/${r.id}`} className="text-brand-600">
                    {r.status} — {r.id.slice(0, 8)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Repairs</p>
            <ul className="mt-2 text-sm">
              {client.repairs.map((r) => (
                <li key={r.id}>
                  <Link href={`/dashboard/repairs/${r.id}`} className="text-brand-600">
                    {repairDisplayTitle(r)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
