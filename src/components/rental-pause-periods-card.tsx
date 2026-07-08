"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { addRentalPausePeriod, deleteRentalPausePeriod } from "@/actions/rentals";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/loading-overlay";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatPausePeriodRange } from "@/lib/rental-pause";
import {
  defaultRentalAnnualYear,
  MONTH_LABELS,
  rentalAnnualYearOptions,
} from "@/lib/rental-annual";

type PausePeriod = {
  id: string;
  pausedAt: string;
  resumedAt: string | null;
};

export function RentalPausePeriodsCard({
  rentalId,
  pausePeriods,
}: {
  rentalId: string;
  pausePeriods: PausePeriod[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const years = rentalAnnualYearOptions();
  const defaultYear = defaultRentalAnnualYear();

  function refresh() {
    router.refresh();
  }

  function handleAdd(formData: FormData) {
    startTransition(async () => {
      await addRentalPausePeriod(rentalId, formData);
      refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Remove this billing pause? Those months will show as active/unpaid again.")) {
      return;
    }
    startTransition(async () => {
      await deleteRentalPausePeriod(id);
      refresh();
    });
  }

  return (
    <>
      {pending && <LoadingOverlay message="Updating pause…" />}
      <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Mark specific months as paused (e.g. vacation break in March–April), even if you are
        recording this later. Remove a pause to bill those months again.
      </p>

      <ul className="divide-y text-sm">
        {pausePeriods.map((period) => (
          <li key={period.id} className="flex items-center justify-between gap-3 py-2">
            <span className="font-medium text-amber-700">
              {formatPausePeriodRange(new Date(period.pausedAt), period.resumedAt ? new Date(period.resumedAt) : null)}
            </span>
            <Button
              type="button"
              variant="ghost"
              className="text-red-600 hover:text-red-700"
              disabled={pending}
              onClick={() => handleDelete(period.id)}
            >
              Remove
            </Button>
          </li>
        ))}
        {pausePeriods.length === 0 && (
          <li className="py-2 text-slate-500">No billing pauses recorded yet.</li>
        )}
      </ul>

      <form action={handleAdd} className="space-y-3 border-t border-slate-100 pt-4">
        <p className="text-sm font-medium text-slate-700">Add pause for month range</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor={`pause-year-${rentalId}`}>Year</Label>
            <Select
              id={`pause-year-${rentalId}`}
              name="year"
              defaultValue={String(defaultYear)}
              className="mt-1"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`pause-from-${rentalId}`}>From month</Label>
            <Select
              id={`pause-from-${rentalId}`}
              name="startMonth"
              defaultValue="2"
              className="mt-1"
            >
              {MONTH_LABELS.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`pause-to-${rentalId}`}>To month</Label>
            <Select id={`pause-to-${rentalId}`} name="endMonth" defaultValue="3" className="mt-1">
              <option value="">Same as from (single month)</option>
              {MONTH_LABELS.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button type="submit" variant="secondary" loading={pending}>
          {pending ? "Saving…" : "Add pause"}
        </Button>
      </form>
    </div>
    </>
  );
}
