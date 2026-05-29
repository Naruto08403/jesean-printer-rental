"use client";

import { importClientsFromCsv } from "@/actions/clients";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function CsvImportClients() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4">
      <p className="text-sm font-medium text-slate-800">Import clients from CSV</p>
      <p className="mt-1 text-xs text-slate-500">
        Only <strong>name</strong> is required. Optional columns: email, phone, address,
        company, notes (headers are flexible: name, client_name, etc.)
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        className="mt-3 block w-full text-sm"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const text = reader.result as string;
            startTransition(async () => {
              try {
                const result = await importClientsFromCsv(text);
                setMessage(`Imported ${result.created} client(s).`);
                router.refresh();
              } catch (err) {
                setMessage(err instanceof Error ? err.message : "Import failed");
              }
            });
          };
          reader.readAsText(file);
        }}
      />
      {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      {pending && (
        <Button variant="secondary" className="mt-2" disabled>
          Importing...
        </Button>
      )}
    </div>
  );
}
