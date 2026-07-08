"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LoadingOverlay } from "@/components/loading-overlay";

export function DatabaseBackupPanel() {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleExport() {
    setError(null);
    setMessage(null);
    setExporting(true);
    try {
      const response = await fetch("/api/database/export");
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Export failed");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "jesean-rentals-backup.json";

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);

      setMessage(`Backup downloaded as ${filename}. Store it somewhere safe on your computer.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  function handleImport() {
    setError(null);
    setMessage(null);

    if (!file) {
      setError("Choose a backup JSON file first.");
      return;
    }
    if (!confirmed) {
      setError("Check the confirmation box before importing.");
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("confirm", "true");

    startTransition(async () => {
      try {
        const response = await fetch("/api/database/import", {
          method: "POST",
          body: formData,
        });
        const body = (await response.json()) as {
          error?: string;
          ok?: boolean;
          exportedAt?: string;
          counts?: Record<string, number>;
        };

        if (!response.ok) {
          throw new Error(body.error ?? "Import failed");
        }

        const total = body.counts
          ? Object.values(body.counts).reduce((sum, n) => sum + n, 0)
          : 0;
        setMessage(
          `Import complete. Restored ${total} records from backup dated ${body.exportedAt ? new Date(body.exportedAt).toLocaleString() : "unknown"}.`
        );
        setFile(null);
        setConfirmed(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      {(exporting || pending) && (
        <LoadingOverlay
          message={exporting ? "Preparing backup…" : "Restoring backup…"}
          submessage="This may take a moment on slower connections."
        />
      )}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-brand-50 p-2 text-brand-700">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-900">Export backup</h2>
            <p className="mt-1 text-sm text-slate-600">
              Download a JSON snapshot of all clients, printers, rentals, repairs, sales, CCTV
              jobs, payments, and admin accounts. Save it on your computer or external drive.
            </p>
            <Button
              type="button"
              className="mt-4"
              onClick={handleExport}
              loading={exporting}
              disabled={pending}
            >
              <Download className="h-4 w-4" />
              {exporting ? "Preparing backup..." : "Download backup"}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-100 p-2 text-amber-800">
            <Upload className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Import backup</h2>
              <p className="mt-1 text-sm text-slate-600">
                Restore from a previously exported JSON file. This replaces all current data in the
                database with the backup contents.
              </p>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-white p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Import is destructive: every existing record is deleted first, then replaced by the
                backup. Export a fresh backup before importing if you might need today&apos;s data
                again.
              </p>
            </div>

            <div>
              <Label htmlFor="backup-file">Backup file (.json)</Label>
              <input
                id="backup-file"
                type="file"
                accept="application/json,.json"
                className="mt-1 block w-full max-w-md text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setError(null);
                }}
              />
            </div>

            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1 rounded border-slate-300"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                I understand this will replace all current database data with the selected backup.
              </span>
            </label>

            <Button
              type="button"
              variant="danger"
              onClick={handleImport}
              loading={pending}
              disabled={exporting || !file}
            >
              <Upload className="h-4 w-4" />
              {pending ? "Importing..." : "Import backup"}
            </Button>
          </div>
        </div>
      </section>

      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
