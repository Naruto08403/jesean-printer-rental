import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { KeyRound, Wrench, ShoppingCart, Cctv } from "lucide-react";

export default async function HomePage() {
  const session = await auth();
  if (session?.user.role === "ADMIN") redirect("/dashboard");
  if (session?.user.role === "CLIENT") redirect("/portal");

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
        <span className="text-xl font-bold text-brand-800">Jesean Rentals</span>
        <Link href="/login">
          <Button>Staff / Client login</Button>
        </Link>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 text-center sm:pt-16">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Your partner for printers & security
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          Printer rentals, repairs, ink & supplies, and CCTV installations — with
          clear billing and a client portal to track your account.
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: KeyRound, title: "Rentals", desc: "Flexible quarterly billing" },
            { icon: Wrench, title: "Repairs", desc: "Full printer service history" },
            { icon: ShoppingCart, title: "Sales", desc: "Inks and office supplies" },
            { icon: Cctv, title: "CCTV", desc: "Professional installation" },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm"
            >
              <Icon className="h-8 w-8 text-brand-600" />
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
