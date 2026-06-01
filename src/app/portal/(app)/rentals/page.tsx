import { auth } from "@/lib/auth";
import { getPortalClientData } from "@/lib/portal-data";
import { redirect } from "next/navigation";
import { PortalRentalCard } from "@/components/portal/portal-rental-card";

export default async function PortalRentalsPage() {
  const session = await auth();
  const clientId = session?.user?.clientId;
  if (!clientId) redirect("/portal/login");

  const data = await getPortalClientData(clientId);
  if (!data) redirect("/portal/login");

  const active = data.rentals.filter(
    (r) => r.status === "ACTIVE" || r.status === "PAUSED"
  );
  const history = data.rentals.filter(
    (r) => r.status === "COMPLETED" || r.status === "CANCELLED"
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Printer rentals</h1>
        <p className="mt-1 text-slate-500">
          {data.rentals.length} rental{data.rentals.length === 1 ? "" : "s"} on your account
        </p>
      </div>

      {active.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Active & paused
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {active.map((r) => (
              <PortalRentalCard key={r.id} rental={r} />
            ))}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            History
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {history.map((r) => (
              <PortalRentalCard key={r.id} rental={r} />
            ))}
          </div>
        </section>
      )}

      {data.rentals.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <p className="text-slate-500">No rental history on your account yet.</p>
        </div>
      )}
    </div>
  );
}
