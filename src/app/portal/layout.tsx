import { SignOutButton } from "@/components/sign-out-button";
import { auth } from "@/lib/auth";
import Link from "next/link";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-lg font-bold text-brand-800">Jesean Rentals</p>
            <p className="text-xs text-slate-500">Client portal · {session?.user?.name}</p>
          </div>
          <SignOutButton />
        </div>
        <nav className="mx-auto flex max-w-3xl gap-4 overflow-x-auto px-4 pb-3 text-sm">
          <Link href="/portal" className="font-medium text-brand-700 hover:underline">
            Overview
          </Link>
          <Link href="/portal/rentals" className="text-slate-600 hover:text-brand-700">
            Rentals
          </Link>
          <Link href="/portal/payments" className="text-slate-600 hover:text-brand-700">
            Payments
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl p-4 pb-12">{children}</main>
    </div>
  );
}
