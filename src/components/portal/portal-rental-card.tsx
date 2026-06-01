import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PortalRentalBalanceStatus } from "@/components/portal/portal-rental-balance";
import { getPortalRentalBalance, type PortalRentalForBalance } from "@/lib/portal-rental-balance";
import { formatCurrency, formatDate } from "@/lib/utils";
import { printerLabel } from "@/lib/portal-data";
import type { RentalStatus } from "@prisma/client";

const statusColor: Record<RentalStatus, "green" | "amber" | "slate" | "red"> = {
  ACTIVE: "green",
  PAUSED: "amber",
  COMPLETED: "slate",
  CANCELLED: "red",
};

export function PortalRentalCard({ rental }: { rental: PortalRentalForBalance & { id: string } }) {
  const balance = getPortalRentalBalance(rental);
  const monthlyRate = rental.printer?.price ?? rental.ratePerPeriod;
  const name = printerLabel(rental.printer);

  return (
    <Link
      href={`/portal/rentals/${rental.id}`}
      className="group block rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900 group-hover:text-brand-700">{name}</p>
          {rental.printer?.serialNumber && (
            <p className="text-xs text-slate-500">SN: {rental.printer.serialNumber}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge color={statusColor[rental.status]}>
            {rental.status.replace("_", " ")}
          </Badge>
          <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
        </div>
      </div>

      <p className="mt-2 text-sm text-slate-500">
        Since {formatDate(rental.startDate)}
        {rental.endDate && ` · until ${formatDate(rental.endDate)}`} · monthly
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-sm font-medium text-slate-700">
          {formatCurrency(monthlyRate)}/month
        </span>
        <PortalRentalBalanceStatus balance={balance} />
      </div>
    </Link>
  );
}
