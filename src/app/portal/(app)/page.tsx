import Link from "next/link";
import { auth } from "@/lib/auth";
import { getPortalClientData, printerLabel } from "@/lib/portal-data";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CheckCircle2,
  CreditCard,
  Printer,
  Wrench,
} from "lucide-react";
import { PortalStatCard } from "@/components/portal/portal-stat-card";
import { PortalRentalCard } from "@/components/portal/portal-rental-card";
import { formatCurrency } from "@/lib/utils";

export default async function PortalDashboardPage() {
  const session = await auth();
  const clientId = session?.user?.clientId;
  if (!clientId) redirect("/portal/login");

  const data = await getPortalClientData(clientId);
  if (!data) redirect("/portal/login");

  const activeRentals = data.rentals.filter(
    (r) => r.status === "ACTIVE" || r.status === "PAUSED"
  );
  const urgentNotifications = data.notifications.filter((n) => n.severity === "urgent");
  const recentPayments = data.rentals
    .flatMap((r) =>
      r.payments.map((p) => ({
        ...p,
        label: printerLabel(r.printer),
      }))
    )
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())
    .slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 px-6 py-8 text-white shadow-xl shadow-brand-900/20 sm:px-8">
        <div className="relative z-10 max-w-xl">
          <p className="text-sm font-medium text-brand-100">Welcome back</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{data.client.name}</h1>
          <p className="mt-2 text-brand-100/90">
            Track your printer rentals, service jobs, and payment history in one place.
          </p>
          {data.stats.totalDue > 0 ? (
            <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm backdrop-blur-sm">
              <AlertCircle className="h-4 w-4" />
              <span>
                <strong>{formatCurrency(data.stats.totalDue)}</strong> outstanding across your account
              </span>
            </div>
          ) : (
            <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 px-4 py-2 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              All caught up — no overdue balances
            </div>
          )}
        </div>
        <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 right-12 h-32 w-32 rounded-full bg-brand-400/20 blur-xl" />
      </section>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PortalStatCard
          label="Active rentals"
          value={String(data.stats.activeRentals)}
          hint={`${data.rentals.length} total on account`}
          icon={Printer}
          accent="brand"
        />
        <PortalStatCard
          label="Amount due"
          value={formatCurrency(data.stats.totalDue)}
          hint={urgentNotifications.length ? `${urgentNotifications.length} overdue item(s)` : "Nothing overdue"}
          icon={Bell}
          accent={data.stats.totalDue > 0 ? "red" : "emerald"}
        />
        <PortalStatCard
          label="Rental balance"
          value={
            data.stats.totalDue > 0
              ? formatCurrency(data.stats.totalDue)
              : "Paid"
          }
          hint={
            data.stats.totalDue > 0
              ? "Overdue monthly rental fees"
              : "No overdue rental months"
          }
          icon={CreditCard}
          accent={data.stats.totalDue > 0 ? "red" : "emerald"}
        />
        <PortalStatCard
          label="Open jobs"
          value={String(data.stats.openJobs)}
          hint="Repairs & CCTV in progress"
          icon={Wrench}
          accent="amber"
        />
      </section>

      {/* Notifications preview */}
      {data.notifications.length > 0 && (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Alerts & reminders</h2>
            <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
              {data.notifications.length}
            </span>
          </div>
          <ul className="mt-4 space-y-2">
            {data.notifications.slice(0, 5).map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3 transition hover:border-brand-200 hover:bg-brand-50/30"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                    <p className="text-xs text-slate-500">{n.message}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {n.amount != null && n.amount > 0 && (
                      <span className="text-sm font-semibold text-red-600">
                        {formatCurrency(n.amount)}
                      </span>
                    )}
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Active rentals */}
      <section>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Your rentals</h2>
          <Link href="/portal/rentals" className="text-sm font-medium text-brand-600 hover:underline">
            View all
          </Link>
        </div>
        {activeRentals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
            No active rentals on your account.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {activeRentals.slice(0, 4).map((r) => (
              <PortalRentalCard key={r.id} rental={r} />
            ))}
          </div>
        )}
      </section>

      {/* Recent activity */}
      {recentPayments.length > 0 && (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent payments</h2>
            <Link href="/portal/payments" className="text-sm font-medium text-brand-600 hover:underline">
              Full history
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {recentPayments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{p.label}</p>
                  <p className="text-xs text-slate-500">
                    {p.paidAt.toLocaleDateString()}
                    {p.reference && ` · OR# ${p.reference}`}
                  </p>
                </div>
                <span className="font-semibold text-emerald-700">{formatCurrency(p.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
