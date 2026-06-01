import { auth } from "@/lib/auth";
import { clientAnnualBillingRow, getPortalClientData, printerLabel } from "@/lib/portal-data";
import { redirect } from "next/navigation";
import { defaultRentalAnnualYear, getClientPaymentSuggestion } from "@/lib/rental-annual";
import { GenerateBillingModal } from "@/components/forms/generate-billing-modal";
import { PortalRentalCard } from "@/components/portal/portal-rental-card";
import { PortalClientBillingSection } from "@/components/portal/portal-client-billing-section";

export default async function PortalRentalsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  const clientId = session?.user?.clientId;
  if (!clientId) redirect("/portal/login");

  const { year: yearParam } = await searchParams;
  const year = yearParam ? parseInt(yearParam, 10) : defaultRentalAnnualYear();

  const data = await getPortalClientData(clientId);
  if (!data) redirect("/portal/login");

  const active = data.rentals.filter(
    (r) => r.status === "ACTIVE" || r.status === "PAUSED"
  );
  const billingRow = clientAnnualBillingRow(active, year);
  const earliestStart =
    active.length > 0
      ? new Date(Math.min(...active.map((r) => r.startDate.getTime())))
      : new Date();
  const history = data.rentals.filter(
    (r) => r.status === "COMPLETED" || r.status === "CANCELLED"
  );

  const billingSuggestion = getClientPaymentSuggestion(active);
  const billingClient = {
    id: data.client.id,
    label: data.client.name,
    monthlyPayable: billingSuggestion?.monthlyPayable ?? 0,
    unitCount: billingSuggestion?.unitCount ?? 0,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Printer rentals</h1>
          <p className="mt-1 text-slate-500">
            {data.rentals.length} rental{data.rentals.length === 1 ? "" : "s"} on your account
          </p>
        </div>
        {billingClient.unitCount > 0 && (
          <GenerateBillingModal
            clients={[billingClient]}
            defaultClientId={billingClient.id}
            triggerLabel="Download billing"
            apiUrl="/api/portal/billing/generate"
            portalMode
          />
        )}
      </div>

      {billingRow && active.length > 0 && (
        <PortalClientBillingSection
          row={billingRow}
          year={year}
          earliestStartDate={earliestStart}
        />
      )}

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
