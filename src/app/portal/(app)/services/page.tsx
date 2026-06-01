import { auth } from "@/lib/auth";
import { getPortalClientData } from "@/lib/portal-data";
import { redirect } from "next/navigation";
import { PortalServiceCard } from "@/components/portal/portal-service-card";
import { ShoppingBag, Shield, Wrench } from "lucide-react";

export default async function PortalServicesPage() {
  const session = await auth();
  const clientId = session?.user?.clientId;
  if (!clientId) redirect("/portal/login");

  const data = await getPortalClientData(clientId);
  if (!data) redirect("/portal/login");

  const hasAny =
    data.repairs.length > 0 || data.sales.length > 0 || data.cctvJobs.length > 0;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Services & purchases</h1>
        <p className="mt-1 text-slate-500">
          Repairs, equipment purchases, and CCTV installations on your account
        </p>
      </div>

      {!hasAny && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <p className="text-slate-500">No service records on your account yet.</p>
        </div>
      )}

      {data.repairs.length > 0 && (
        <section id="repairs">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Wrench className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Repairs</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {data.repairs.length}
            </span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.repairs.map((r) => (
              <PortalServiceCard
                key={r.id}
                kind="repair"
                title={r.title}
                subtitle={r.description ?? undefined}
                status={r.status}
                totalAmount={r.totalAmount}
                payments={r.payments}
                date={r.createdAt}
                printer={r.printer}
              />
            ))}
          </div>
        </section>
      )}

      {data.sales.length > 0 && (
        <section id="purchases">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Purchases</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {data.sales.length}
            </span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.sales.map((s) => (
              <PortalServiceCard
                key={s.id}
                kind="purchase"
                title={s.items}
                subtitle={s.notes ?? undefined}
                status={s.status}
                totalAmount={s.totalAmount}
                payments={s.payments}
                date={s.createdAt}
              />
            ))}
          </div>
        </section>
      )}

      {data.cctvJobs.length > 0 && (
        <section id="cctv">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Shield className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">CCTV installations</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {data.cctvJobs.length}
            </span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.cctvJobs.map((j) => (
              <PortalServiceCard
                key={j.id}
                kind="cctv"
                title={j.siteAddress ?? "CCTV installation"}
                subtitle={j.description ?? undefined}
                status={j.status}
                totalAmount={j.totalAmount}
                payments={j.payments}
                date={j.createdAt}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
