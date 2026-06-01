"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Home, Lock, User } from "lucide-react";

export default function PortalLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      username: fd.get("username"),
      password: fd.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid username or password");
      return;
    }
    router.refresh();
    router.push("/portal");
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <Home className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xl font-bold">Jesean Rentals</p>
            <p className="text-sm text-brand-100">Client portal</p>
          </div>
        </div>
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight">
            Your rentals, payments & services — all in one place
          </h1>
          <p className="mt-4 text-brand-100/90">
            View printer rentals, track due payments, check repair status, and browse your full
            payment history anytime.
          </p>
        </div>
        <p className="text-sm text-brand-200/70">© Jesean Rentals</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-[#f4f7fb] px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <p className="text-xl font-bold text-brand-800">Jesean Rentals</p>
            <p className="text-sm text-slate-500">Client portal sign in</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-200/50">
            <h2 className="text-xl font-bold text-slate-900">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500">
              Sign in with the username and password from your provider.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <div className="relative mt-1">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    required
                    autoComplete="username"
                    autoCapitalize="none"
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-1">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="pl-10"
                  />
                </div>
              </div>
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in to portal"}
              </Button>
            </form>

            <Link
              href="/"
              className="mt-6 block text-center text-sm text-brand-600 hover:underline"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
