"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { importPrintersFromCsv } from "@/actions/printers";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/loading-overlay";

export function ImportPrintersModal() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <>
      {pending && <LoadingOverlay message="Importing printers…" />}
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" />
        Import CSV
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Import printers from CSV">
        <p className="text-sm text-slate-500">
          Required: <strong>serial_number</strong>. Optional: brand, model, client_name, notes,
          status (AVAILABLE, RENTED, IN_REPAIR, RETIRED).
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
                  const result = await importPrintersFromCsv(text);
                  setMessage(
                    `Imported ${result.created} printer(s).${result.skipped ? ` Skipped ${result.skipped} duplicate serial(s).` : ""}`
                  );
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
