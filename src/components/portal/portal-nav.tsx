"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, LayoutDashboard, Printer, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/portal", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/portal/rentals", label: "Rentals", icon: Printer },
  { href: "/portal/services", label: "Services", icon: Wrench },
  { href: "/portal/payments", label: "Pay", icon: CreditCard },
];

export function PortalMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur-md lg:hidden">
      <div className="mx-auto flex max-w-lg justify-around">
        {navItems.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium",
                active ? "text-brand-700" : "text-slate-500"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-brand-600")} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function PortalSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {navItems.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand-600 text-white shadow-sm shadow-brand-600/20"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label === "Home" ? "Dashboard" : item.label === "Pay" ? "Payments" : item.label}
          </Link>
        );
      })}
    </nav>
  );
}
