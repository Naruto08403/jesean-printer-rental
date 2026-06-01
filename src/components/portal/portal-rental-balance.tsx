import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { PortalRentalBalance } from "@/lib/portal-rental-balance";

export function PortalRentalBalanceStatus({ balance }: { balance: PortalRentalBalance }) {
  if (balance.label === "overdue") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge color="red">Overdue</Badge>
        <span className="font-semibold text-red-700">
          {formatCurrency(balance.overdueBalance)}
        </span>
        {balance.overdueMonths.length > 0 && (
          <span className="text-slate-500">
            ({balance.overdueMonths.join(", ")})
          </span>
        )}
      </div>
    );
  }

  if (balance.label === "paused") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge color="amber">Paused</Badge>
        <span className="text-slate-500">No balance due</span>
      </div>
    );
  }

  if (balance.label === "inactive") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge color="slate">Ended</Badge>
        {balance.overdueBalance > 0 ? (
          <span className="font-semibold text-red-700">
            {formatCurrency(balance.overdueBalance)} overdue
          </span>
        ) : (
          <span className="text-slate-500">Paid</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Badge color="green">Paid</Badge>
      <span className="text-slate-500">No balance due</span>
    </div>
  );
}
