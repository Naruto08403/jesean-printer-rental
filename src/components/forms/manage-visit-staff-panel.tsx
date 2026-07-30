"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  createVisitStaffUser,
  deleteVisitStaffUser,
} from "@/actions/visit-staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/utils";

type StaffRow = {
  id: string;
  username: string | null;
  name: string | null;
  createdAt: Date;
};

export function ManageVisitStaffPanel({ staff }: { staff: StaffRow[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete(id: string, username: string | null) {
    const label = username ?? "this account";
    if (!confirm(`Remove visit staff "${label}"?`)) return;
    startTransition(async () => {
      await deleteVisitStaffUser(id);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Visit staff accounts</h2>
          <p className="mt-1 text-sm text-slate-600">
            Staff can sign in at <span className="font-medium">/visits/login</span> — visits
            only, no dashboard access.
          </p>
        </div>
        <Button type="button" onClick={() => setOpen(true)} className="shrink-0">
          <Plus className="h-4 w-4" />
          Add staff
        </Button>
      </div>

      {staff.length > 0 && (
        <ul className="mt-4 divide-y rounded-lg border border-slate-200">
          {staff.map((user) => (
            <li
              key={user.id}
              className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
            >
              <div>
                <p className="font-medium text-slate-900">{user.username}</p>
                <p className="text-sm text-slate-500">
                  {user.name ?? "No display name"} · Added {formatDate(user.createdAt)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="self-start text-red-600 hover:text-red-700 sm:self-auto"
                onClick={() => handleDelete(user.id, user.username)}
                disabled={pending}
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add visit staff">
        <form
          className="space-y-3"
          action={(fd) =>
            startTransition(async () => {
              await createVisitStaffUser(fd);
              setOpen(false);
              router.refresh();
            })
          }
        >
          <div>
            <Label htmlFor="staff-username">Username *</Label>
            <Input
              id="staff-username"
              name="username"
              required
              autoCapitalize="none"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="staff-name">Display name</Label>
            <Input id="staff-name" name="name" className="mt-1" placeholder="Optional" />
          </div>
          <div>
            <Label htmlFor="staff-password">Password *</Label>
            <Input
              id="staff-password"
              name="password"
              type="password"
              minLength={6}
              required
              className="mt-1"
            />
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {pending ? "Creating…" : "Create account"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
