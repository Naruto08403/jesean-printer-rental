"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { PortalNotification } from "@/lib/portal-data";

const severityStyles = {
  urgent: "border-l-red-500 bg-red-50/80",
  warning: "border-l-amber-500 bg-amber-50/80",
  info: "border-l-brand-500 bg-brand-50/80",
};

export function PortalNotifications({
  notifications,
}: {
  notifications: PortalNotification[];
}) {
  const [open, setOpen] = useState(false);
  const count = notifications.length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:border-brand-200 hover:text-brand-700"
        aria-label={`Notifications${count ? `, ${count} items` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="font-semibold text-slate-900">Notifications</p>
              <p className="text-xs text-slate-500">
                {count === 0 ? "You're all caught up" : `${count} item${count === 1 ? "" : "s"}`}
              </p>
            </div>
            <ul className="max-h-80 overflow-y-auto">
              {notifications.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-slate-500">
                  No alerts right now. All payments are up to date.
                </li>
              )}
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={`block border-l-4 px-4 py-3 transition hover:bg-slate-50 ${severityStyles[n.severity]}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{n.title}</p>
                        <p className="mt-0.5 text-xs text-slate-600">{n.message}</p>
                        {n.amount != null && n.amount > 0 && (
                          <p className="mt-1 text-xs font-semibold text-red-700">
                            {formatCurrency(n.amount)} due
                          </p>
                        )}
                      </div>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
