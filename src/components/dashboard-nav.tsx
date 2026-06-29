"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Printer,
  KeyRound,
  Wrench,
  ShoppingCart,
  Cctv,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  DatabaseBackup,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";

const STORAGE_KEY = "dashboard-sidebar-collapsed";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/printers", label: "Printers", icon: Printer },
  { href: "/dashboard/rentals", label: "Rentals", icon: KeyRound },
  { href: "/dashboard/repairs", label: "Repairs", icon: Wrench },
  { href: "/dashboard/sales", label: "Sales", icon: ShoppingCart },
  { href: "/dashboard/cctv", label: "CCTV", icon: Cctv },
  { href: "/dashboard/backup", label: "Backup", icon: DatabaseBackup, section: "system" as const },
];

export function DashboardShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail?: string | null;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const sidebarWidth = collapsed ? "lg:w-[4.5rem]" : "lg:w-64";
  const mainOffset = collapsed ? "lg:pl-[4.5rem]" : "lg:pl-64";

  return (
    <div className="min-h-screen lg:flex">
      <button
        type="button"
        className="fixed left-4 top-4 z-50 rounded-lg bg-brand-700 p-2 text-white shadow-lg lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-brand-800 transition-[width,transform] duration-200 lg:translate-x-0",
          sidebarWidth,
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          <div
            className={cn(
              "mb-4 flex items-center gap-2",
              collapsed && mounted ? "justify-center px-0" : "justify-between px-2"
            )}
          >
            {(!collapsed || !mounted) && (
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-white">Jesean Rentals</p>
                <p className="text-xs text-brand-200">Business dashboard</p>
              </div>
            )}
            <button
              type="button"
              onClick={toggleCollapsed}
              title={collapsed && mounted ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed && mounted ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "hidden shrink-0 rounded-lg p-2 text-brand-100 transition hover:bg-white/10 hover:text-white lg:flex lg:items-center lg:justify-center",
                collapsed && mounted && "mx-auto"
              )}
            >
              {collapsed && mounted ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </button>
          </div>

          {links.map(({ href, label, icon: Icon, section }) => {
            const active =
              pathname === href ||
              (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <span key={href} className="contents">
                {section === "system" && (
                  <>
                    <div className="my-2 border-t border-white/10" />
                    {(!collapsed || !mounted) && (
                      <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-brand-300">
                        System
                      </p>
                    )}
                  </>
                )}
                <Link
                  href={href}
                  title={collapsed && mounted ? label : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center rounded-lg py-2.5 text-sm font-medium transition",
                    collapsed && mounted
                      ? "justify-center px-2"
                      : "gap-3 px-3",
                    active
                      ? "bg-white/15 text-white"
                      : "text-brand-100 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {(!collapsed || !mounted) && <span>{label}</span>}
                </Link>
              </span>
            );
          })}
        </nav>
      </aside>

      <div className={cn("flex min-w-0 flex-1 flex-col transition-[padding] duration-200", mainOffset)}>
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <p className="pl-12 text-sm text-slate-600 lg:pl-0">
            Signed in as <span className="font-medium">{userEmail}</span>
          </p>
          <SignOutButton />
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}