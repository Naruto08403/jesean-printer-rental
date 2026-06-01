import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { formatRepairCustomerLabel, repairDisplayTitle, sourceLabel } from "@/lib/repair-device";
import { Badge } from "@/components/ui/badge";
import type { Repair, Client, Payment } from "@prisma/client";

type RepairRow = Repair & {
  client: Client | null;
  payments: Payment[];
};

export function RepairDeviceHistory({ repairs, currentId }: { repairs: RepairRow[]; currentId: string }) {
  const others = repairs.filter((r) => r.id !== currentId);

  if (repairs.length === 0) {
    return <p className="text-sm text-slate-500">No repair history for this device yet.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {repairs.length} repair{repairs.length === 1 ? "" : "s"} on record for this serial / device.
      </p>
      <ul className="divide-y rounded-lg border border-slate-200">
        {repairs.map((r) => (
          <li
            key={r.id}
            className={`flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm ${
              r.id === currentId ? "bg-brand-50/50" : ""
            }`}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {r.id === currentId ? (
                  <Badge color="blue">This job</Badge>
                ) : (
                  <Link href={`/dashboard/repairs/${r.id}`} className="font-medium text-brand-600 hover:underline">
                    View
                  </Link>
                )}
                <Badge color="slate">{sourceLabel(r.source)}</Badge>
                <span className="text-slate-500">{formatDate(r.receivedAt)}</span>
              </div>
              <p className="mt-1 font-medium text-slate-900">{repairDisplayTitle(r)}</p>
              <p className="text-slate-600">{formatRepairCustomerLabel(r)}</p>
              {r.diagnosis && <p className="mt-1 text-slate-500">Dx: {r.diagnosis}</p>}
            </div>
            <div className="text-right">
              {r.isChargeWaived ? (
                <span className="text-emerald-700">No charge</span>
              ) : (
                <span className="font-semibold">{formatCurrency(r.totalAmount)}</span>
              )}
              <p className="text-xs text-slate-500">{r.status.replace("_", " ")}</p>
            </div>
          </li>
        ))}
      </ul>
      {others.length > 0 && (
        <p className="text-xs text-slate-500">
          {others.length} prior job{others.length === 1 ? "" : "s"} — useful for walk-ins and repeat customers.
        </p>
      )}
    </div>
  );
}
