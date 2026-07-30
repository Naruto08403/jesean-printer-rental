"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, MapPin, Pencil, Trash2 } from "lucide-react";
import {
  createClientVisit,
  deleteClientVisit,
  updateClientVisit,
  type VisitClientRow,
  type VisitHistoryItem,
} from "@/actions/client-visits";
import {
  VISIT_REASONS,
  daysAfterClass,
  formatDaysAfter,
  visitRowClass,
  type VisitReason,
} from "@/lib/client-visits";
import { formatDate } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

function todayInput() {
  return new Date().toISOString().split("T")[0]!;
}

function toDateInput(iso: string) {
  return iso.slice(0, 10);
}

function reasonFromVisit(visit: VisitHistoryItem): {
  reason: string;
  customReason: string;
} {
  if (VISIT_REASONS.includes(visit.reason as VisitReason)) {
    return { reason: visit.reason, customReason: "" };
  }
  return { reason: "Other", customReason: visit.reason };
}

function VisitRecordForm({
  reason,
  setReason,
  pending,
  onCancel,
  onSubmit,
  initial,
  submitLabel,
}: {
  reason: string;
  setReason: (value: string) => void;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (fd: FormData) => void;
  initial?: VisitHistoryItem;
  submitLabel: string;
}) {
  const initialReason = initial ? reasonFromVisit(initial) : null;

  return (
    <form className="space-y-3" action={onSubmit}>
      <div>
        <Label htmlFor="visitedAt">Visit date *</Label>
        <Input
          id="visitedAt"
          name="visitedAt"
          type="date"
          defaultValue={initial ? toDateInput(initial.visitedAt) : todayInput()}
          required
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="reason">Reason *</Label>
        <Select
          id="reason"
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1"
          required
        >
          {VISIT_REASONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </div>
      {reason === "Other" && (
        <div>
          <Label htmlFor="customReason">Specify reason *</Label>
          <Input
            id="customReason"
            name="customReason"
            required
            defaultValue={initialReason?.customReason ?? ""}
            className="mt-1"
            placeholder="Describe the visit reason"
          />
        </div>
      )}
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          name="notes"
          defaultValue={initial?.notes ?? ""}
          className="mt-1"
          placeholder="Optional"
        />
      </div>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button type="submit" loading={pending} className="w-full sm:w-auto">
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function VisitHistoryList({
  client,
  canManage,
  onEdit,
  onDelete,
  pending,
}: {
  client: VisitClientRow;
  canManage: boolean;
  onEdit: (visit: VisitHistoryItem) => void;
  onDelete: (visit: VisitHistoryItem) => void;
  pending: boolean;
}) {
  if (client.visits.length === 0) {
    return <p className="text-sm text-slate-500">No visits recorded yet.</p>;
  }

  return (
    <ul className="divide-y rounded-lg border border-slate-200">
      {client.visits.map((visit) => (
        <li key={visit.id} className="px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{visit.reason}</p>
              {visit.notes && <p className="mt-1 text-sm text-slate-600">{visit.notes}</p>}
              <p className="mt-1 text-sm text-slate-500 sm:hidden">
                {formatDate(visit.visitedAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <p className="hidden text-sm text-slate-500 sm:block">
                {formatDate(visit.visitedAt)}
              </p>
              {canManage && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Edit visit"
                    onClick={() => onEdit(visit)}
                    disabled={pending}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    aria-label="Delete visit"
                    onClick={() => onDelete(visit)}
                    disabled={pending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function VisitsWorkspace({
  rows,
  canManage = false,
}: {
  rows: VisitClientRow[];
  canManage?: boolean;
}) {
  const [historyClient, setHistoryClient] = useState<VisitClientRow | null>(null);
  const [visitClient, setVisitClient] = useState<VisitClientRow | null>(null);
  const [editVisit, setEditVisit] = useState<VisitHistoryItem | null>(null);
  const [reason, setReason] = useState<string>(VISIT_REASONS[0]);
  const [editReason, setEditReason] = useState<string>(VISIT_REASONS[0]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const daysA = a.daysAfter ?? Number.MAX_SAFE_INTEGER;
        const daysB = b.daysAfter ?? Number.MAX_SAFE_INTEGER;
        if (daysB !== daysA) return daysB - daysA;
        return a.clientName.localeCompare(b.clientName);
      }),
    [rows]
  );

  function openVisit(client: VisitClientRow, event?: React.MouseEvent) {
    event?.stopPropagation();
    setReason(VISIT_REASONS[0]);
    setVisitClient(client);
  }

  function closeVisitModal() {
    setVisitClient(null);
    setReason(VISIT_REASONS[0]);
  }

  function openEdit(visit: VisitHistoryItem) {
    const parsed = reasonFromVisit(visit);
    setEditReason(parsed.reason);
    setEditVisit(visit);
  }

  function closeEditModal() {
    setEditVisit(null);
    setEditReason(VISIT_REASONS[0]);
  }

  function submitVisit(fd: FormData) {
    if (!visitClient) return;
    startTransition(async () => {
      fd.set("clientId", visitClient.clientId);
      await createClientVisit(fd);
      closeVisitModal();
      setHistoryClient(null);
      router.refresh();
    });
  }

  function submitEdit(fd: FormData) {
    if (!editVisit) return;
    startTransition(async () => {
      await updateClientVisit(editVisit.id, fd);
      closeEditModal();
      router.refresh();
    });
  }

  function handleDelete(visit: VisitHistoryItem) {
    if (!confirm(`Delete visit on ${formatDate(visit.visitedAt)}?`)) return;
    startTransition(async () => {
      await deleteClientVisit(visit.id);
      router.refresh();
    });
  }

  if (sortedRows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
        No active rental clients to track.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {sortedRows.map((row) => (
          <article
            key={row.clientId}
            className={cn(
              "cursor-pointer rounded-xl border p-4 shadow-sm transition",
              visitRowClass(row.daysAfter)
            )}
            onClick={() => setHistoryClient(row)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{row.clientName}</p>
                <p className="mt-1 text-sm text-slate-600">
                  Last visit:{" "}
                  <span className="font-medium">
                    {row.lastVisitAt ? formatDate(row.lastVisitAt) : "Never"}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-sm text-slate-600">
                  Reason: {row.lastReason ?? "—"}
                </p>
                <p className={cn("mt-2 text-sm", daysAfterClass(row.daysAfter))}>
                  Days after: {formatDaysAfter(row.daysAfter)}
                </p>
              </div>
              <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            </div>
            {canManage && (
              <div className="mt-4 border-t border-inherit pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={(event) => openVisit(row, event)}
                >
                  <MapPin className="h-4 w-4" />
                  Visit
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-slate-500">
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Last visit</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Days after</th>
              {canManage && <th className="px-4 py-3 font-medium">Action</th>}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr
                key={row.clientId}
                onClick={() => setHistoryClient(row)}
                className={cn("cursor-pointer border-b transition", visitRowClass(row.daysAfter))}
              >
                <td className="px-4 py-3 font-medium text-slate-900">{row.clientName}</td>
                <td className="px-4 py-3 text-slate-600">
                  {row.lastVisitAt ? formatDate(row.lastVisitAt) : "—"}
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 text-slate-600">
                  {row.lastReason ?? "—"}
                </td>
                <td className={cn("px-4 py-3", daysAfterClass(row.daysAfter))}>
                  {formatDaysAfter(row.daysAfter)}
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={(event) => openVisit(row, event)}
                    >
                      <MapPin className="h-4 w-4" />
                      Visit
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={Boolean(historyClient)}
        onClose={() => setHistoryClient(null)}
        title={historyClient ? `${historyClient.clientName} — visits` : "Visits"}
        className="max-w-lg"
      >
        {historyClient && (
          <div className="space-y-3">
            <VisitHistoryList
              client={historyClient}
              canManage={canManage}
              onEdit={openEdit}
              onDelete={handleDelete}
              pending={pending}
            />
            {canManage && (
              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={(event) => {
                    openVisit(historyClient, event);
                    setHistoryClient(null);
                  }}
                >
                  <MapPin className="h-4 w-4" />
                  Record visit
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(visitClient)}
        onClose={closeVisitModal}
        title={visitClient ? `Visit — ${visitClient.clientName}` : "Record visit"}
        className="max-w-md"
      >
        {visitClient && (
          <VisitRecordForm
            reason={reason}
            setReason={setReason}
            pending={pending}
            onCancel={closeVisitModal}
            onSubmit={submitVisit}
            submitLabel="Save visit"
          />
        )}
      </Modal>

      <Modal
        open={Boolean(editVisit)}
        onClose={closeEditModal}
        title="Edit visit"
        className="max-w-md"
      >
        {editVisit && (
          <VisitRecordForm
            reason={editReason}
            setReason={setEditReason}
            pending={pending}
            onCancel={closeEditModal}
            onSubmit={submitEdit}
            initial={editVisit}
            submitLabel="Update visit"
          />
        )}
      </Modal>
    </>
  );
}
