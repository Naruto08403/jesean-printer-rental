import { auth, requireVisitStaffOrAdmin } from "@/lib/auth";
import { listActiveRentalVisitClients } from "@/actions/client-visits";
import { VisitsWorkspace } from "@/components/visits-workspace";
import { ManageVisitStaff } from "@/components/forms/manage-visit-staff";
import { VISIT_OVERDUE_DAYS, isVisitOverdue } from "@/lib/client-visits";

export async function VisitsPageContent({
  showStaffAdmin = false,
  embedInDashboard = false,
  title = "Visits",
}: {
  showStaffAdmin?: boolean;
  embedInDashboard?: boolean;
  title?: string;
}) {
  await requireVisitStaffOrAdmin();
  const session = await auth();
  const rows = await listActiveRentalVisitClients();

  const overdue = rows.filter((row) => isVisitOverdue(row.daysAfter)).length;
  const neverVisited = rows.filter((row) => row.lastVisitAt == null).length;

  const statsLine = `${rows.length} active rental clients · ${neverVisited} never visited · ${overdue} over ${VISIT_OVERDUE_DAYS} days${
    session?.user?.name ? ` · Signed in as ${session.user.name}` : ""
  }`;

  return (
    <div className="space-y-4 sm:space-y-6">
      {embedInDashboard ? (
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visits</h1>
          <p className="mt-1 text-sm text-slate-600">{statsLine}</p>
        </div>
      ) : (
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{statsLine}</p>
        </div>
      )}

      <p className="text-sm text-slate-600">
        Track ink refill and service visits. Rows turn red when more than {VISIT_OVERDUE_DAYS}{" "}
        days have passed since the last visit. Tap a client to view, edit, or delete visits.
      </p>

      {showStaffAdmin && session?.user.role === "ADMIN" && <ManageVisitStaff />}

      <VisitsWorkspace rows={rows} canManage />
    </div>
  );
}
