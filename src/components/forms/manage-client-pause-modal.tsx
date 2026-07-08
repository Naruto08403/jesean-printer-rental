"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff } from "lucide-react";
import { addClientPausePeriod, deleteClientPausePeriods } from "@/actions/rentals";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/loading-overlay";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  defaultRentalAnnualYear,
  MONTH_LABELS,
  rentalAnnualYearOptions,
} from "@/lib/rental-annual";

type ClientOption = { id: string; label: string };

type ClientPauseGroup = {
  key: string;
  label: string;
  ids: string[];
};

export function ManageClientPauseModal({
  clients,
  pauseGroupsByClient,
}: {
  clients: ClientOption[];
  pauseGroupsByClient: Record<string, ClientPauseGroup[]>;
}) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const years = rentalAnnualYearOptions();
  const defaultYear = defaultRentalAnnualYear();

  const pauseGroups = useMemo(
    () => (clientId ? (pauseGroupsByClient[clientId] ?? []) : []),
    [clientId, pauseGroupsByClient]
  );

  function resetForm() {
    setClientId("");
    setError(null);
  }

  function refresh() {
    router.refresh();
  }

  function handleAdd(formData: FormData) {
    if (!clientId) {
      setError("Select a client first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await addClientPausePeriod(clientId, formData);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add pause");
      }
    });
  }

  function handleDelete(group: ClientPauseGroup) {
    if (
      !confirm(
        `Remove pause "${group.label}" for all units? Those months will show as active/unpaid again.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      await deleteClientPausePeriods(group.ids);
      refresh();
    });
  }

  return (
    <>
      {pending && <LoadingOverlay message="Updating pauses…" />}
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <CalendarOff className="h-4 w-4" />
        Pause months
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title="Manage billing pauses"
        className="max-w-xl"
      >
        <div className="space-y-5">
          <p className="text-sm text-slate-500">
            Mark past or future months as paused for all active units under a client (e.g. March–April
            vacation). Remove a pause to bill those months again.
          </p>

          <div>
            <Label htmlFor="pause-client">Client</Label>
            <Select
              id="pause-client"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setError(null);
              }}
              className="mt-1"
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>

          {clientId && (
            <div>
              <p className="text-sm font-medium text-slate-700">Existing pauses (all units)</p>
              <ul className="mt-2 divide-y text-sm">
                {pauseGroups.map((group) => (
                  <li key={group.key} className="flex items-center justify-between gap-3 py-2">
                    <span className="font-medium text-amber-700">{group.label}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      loading={pending}
                      onClick={() => handleDelete(group)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
                {pauseGroups.length === 0 && (
                  <li className="py-2 text-slate-500">No billing pauses for this client.</li>
                )}
              </ul>
            </div>
          )}

          <form action={handleAdd} className="space-y-3 border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-700">Add pause for all units</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="client-pause-year">Year</Label>
                <Select
                  id="client-pause-year"
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
                <Label htmlFor="client-pause-from">From month</Label>
                <Select id="client-pause-from" name="startMonth" defaultValue="2" className="mt-1">
                  {MONTH_LABELS.map((label, i) => (
                    <option key={label} value={i}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="client-pause-to">To month</Label>
                <Select id="client-pause-to" name="endMonth" defaultValue="3" className="mt-1">
                  <option value="">Same as from (single month)</option>
                  {MONTH_LABELS.map((label, i) => (
                    <option key={label} value={i}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" loading={pending} disabled={!clientId}>
              {pending ? "Saving…" : "Add pause for all units"}
            </Button>
          </form>
        </div>
      </Modal>
    </>
  );
}
