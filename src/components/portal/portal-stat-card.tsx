import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const accentStyles = {
  brand: "from-brand-500 to-brand-700 shadow-brand-600/20",
  emerald: "from-emerald-500 to-emerald-700 shadow-emerald-600/20",
  amber: "from-amber-500 to-amber-600 shadow-amber-600/20",
  red: "from-red-500 to-red-600 shadow-red-600/20",
  slate: "from-slate-500 to-slate-700 shadow-slate-600/20",
};

export function PortalStatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "brand",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: keyof typeof accentStyles;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg",
            accentStyles[accent]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
