"use client";

import { addPayment } from "@/actions/payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTransition } from "react";

type Target =
  | { type: "rental"; id: string }
  | { type: "repair"; id: string }
  | { type: "sale"; id: string }
  | { type: "cctv"; id: string };

export function PaymentForm({ target }: { target: Target }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      action={(fd) =>
        startTransition(async () => {
          await addPayment(target, fd);
        })
      }
    >
      <div>
        <Label htmlFor="amount">Amount (PHP)</Label>
        <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
      </div>
      <div>
        <Label htmlFor="paidAt">Date paid</Label>
        <Input
          id="paidAt"
          name="paidAt"
          type="datetime-local"
          defaultValue={new Date().toISOString().slice(0, 16)}
        />
      </div>
      <div>
        <Label htmlFor="method">Method</Label>
        <Input id="method" name="method" placeholder="Cash, GCash, Bank..." />
      </div>
      <div>
        <Label htmlFor="reference">Reference</Label>
        <Input id="reference" name="reference" placeholder="Receipt / ref #" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" name="notes" />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Recording..." : "Record payment"}
        </Button>
      </div>
    </form>
  );
}
