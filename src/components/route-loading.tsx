import { Spinner } from "@/components/ui/spinner";

export function RouteLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4">
      <Spinner size="lg" className="text-brand-600" />
      <p className="text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}
