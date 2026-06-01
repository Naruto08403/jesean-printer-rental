import { Home } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { PortalMobileNav, PortalSidebarNav } from "@/components/portal/portal-nav";
import { PortalNotifications } from "@/components/portal/portal-notifications";
import type { PortalNotification } from "@/lib/portal-data";

export function PortalShell({
  userName,
  notifications,
  children,
}: {
  userName: string;
  notifications: PortalNotification[];
  children: React.ReactNode;
}) {
  const urgentCount = notifications.filter((n) => n.severity === "urgent").length;

  return (
    <div className="min-h-screen bg-[#f4f7fb]">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white p-5 lg:flex">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/25">
              <Home className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-slate-900">Jesean Rentals</p>
              <p className="text-xs text-slate-500">Client portal</p>
            </div>
          </div>

          <PortalSidebarNav />

          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="truncate text-sm font-medium text-slate-900">{userName}</p>
            <p className="text-xs text-slate-500">Signed in</p>
            <div className="mt-3">
              <SignOutButton />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
            <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-8">
              <div className="lg:hidden">
                <p className="font-bold text-brand-800">Jesean Rentals</p>
                <p className="text-xs text-slate-500">{userName}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <PortalNotifications notifications={notifications} />
                {urgentCount > 0 && (
                  <span className="hidden items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200 sm:inline-flex">
                    {urgentCount} overdue
                  </span>
                )}
                <div className="hidden lg:block">
                  <SignOutButton />
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 pb-24 lg:px-8 lg:pb-8">{children}</main>
          <PortalMobileNav />
        </div>
      </div>
    </div>
  );
}
