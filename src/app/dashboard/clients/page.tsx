import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DataTableElement } from "@/components/data-table";
import {
  SearchableDataTable,
  SearchNoMatchRow,
} from "@/components/searchable-data-table";
import { toSearchText } from "@/lib/search";
import { AddClientModal } from "@/components/forms/add-client-modal";
import { ImportClientsModal } from "@/components/forms/import-clients-modal";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: { user: { select: { email: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" subtitle={`${clients.length} total`}>
        <ImportClientsModal />
        <AddClientModal />
      </PageHeader>

      <SearchableDataTable placeholder="Search clients by name, email, phone, company...">
        <DataTableElement>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-500">
              <th className="px-4 py-3 font-medium">Name</th>
              {/* <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Company</th> */}
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Portal</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No clients yet. Add one or import CSV.
                </td>
              </tr>
            )}
            {clients.map((c) => (
              <tr
                key={c.id}
                data-search-row
                data-search={toSearchText(
                  c.name,
                  c.email,
                  c.phone,
                  c.company,
                  c.user ? "portal active" : "portal none"
                )}
                className="border-b border-slate-50 hover:bg-slate-50/50"
              >
                <td className="px-4 py-3 font-medium">{c.name}</td>
                {/* <td className="px-4 py-3 text-slate-600">{c.email ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{c.phone ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{c.company ?? "—"}</td> */}
                <td className="px-4 py-3">
                  {c.status === "STOPPED" ? (
                    <Badge color="amber">Stop</Badge>
                  ) : (
                    <Badge color="green">Active</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  {c.user ? (
                    <Badge color="green">Active</Badge>
                  ) : (
                    <Badge color="slate">None</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/dashboard/clients/${c.id}`}
                    className="text-brand-600 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            <SearchNoMatchRow colSpan={7} />
          </tbody>
        </DataTableElement>
      </SearchableDataTable>
    </div>
  );
}
