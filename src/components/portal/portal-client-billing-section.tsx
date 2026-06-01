import Link from "next/link";
import { defaultRentalAnnualYear, rentalAnnualYearOptions } from "@/lib/rental-annual";
import { PortalClientBillingGrid } from "@/components/portal/portal-client-billing-grid";
import type { ClientAnnualRow } from "@/lib/rental-annual";

export function PortalClientBillingSection({
  row,
  year: initialYear,
  earliestStartDate,
}: {
  row: ClientAnnualRow;
  year?: number;
  earliestStartDate: Date;
}) {
  const years = rentalAnnualYearOptions();
  const year = initialYear ?? defaultRentalAnnualYear();

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Monthly rentals</h2>
          <p className="text-sm text-slate-500">{row.clientName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {years.map((y) => (
            <Link
              key={y}
              href={`/portal/rentals?year=${y}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                y === year
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700"
              }`}
            >
              {y}
            </Link>
          ))}
        </div>
      </div>
      <PortalClientBillingGrid row={row} year={year} startDate={earliestStartDate} />
    </section>
  );
}
