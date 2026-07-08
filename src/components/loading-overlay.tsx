"use client";

import { Spinner } from "@/components/ui/spinner";

export function LoadingOverlay({
  message = "Please wait…",
  submessage,
}: {
  message?: string;
  submessage?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-white px-6 py-8 text-center shadow-2xl">
        <Spinner size="lg" className="mx-auto text-brand-600" />
        <p className="mt-4 text-base font-semibold text-slate-900">{message}</p>
        {submessage && <p className="mt-1 text-sm text-slate-500">{submessage}</p>}
      </div>
    </div>
  );
}
