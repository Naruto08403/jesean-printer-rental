"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { importRentalsFromCsv } from "@/actions/rentals";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

export function ImportRentalsModal() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" />
        Import CSV
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Import rentals from CSV">
        <p className="text-sm text-slate-500">
          Import clients and printers first. Required: <strong>client_name</strong>,{" "}
          <strong>serial_number</strong>, <strong>start_date</strong>,{" "}
          <strong>rate_per_period</strong>. See <code>Data/rentals-import.csv</code>.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          className="mt-4 block w-full text-sm"
          disabled={pending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              const text = reader.result as string;
              startTransition(async () => {
                try {
                  const result = await importRentalsFromCsv(text);
                  let msg = `Imported ${result.created} rental(s).`;
                  if (result.skipped) msg += ` Skipped ${result.skipped}.`;
                  if (result.errors.length) msg += ` ${result.errors.join("; ")}`;
                  setMessage(msg);
                  router.refresh();
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : "Import failed");
                }
              });
            };
            reader.readAsText(file);
            e.target.value = "";
          }}
        />
        {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </Modal>
    </>
  );
}
