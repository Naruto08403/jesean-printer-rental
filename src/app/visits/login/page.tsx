"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingOverlay } from "@/components/loading-overlay";
import Link from "next/link";
import { MapPin } from "lucide-react";

export default function VisitStaffLoginPage() {
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
    if (res?.error) {
      setLoading(false);
      setError("Invalid username or password");
      return;
    }
    router.refresh();
    router.push("/visits");
  }

  return (
    <>
      {loading && (
        <LoadingOverlay message="Signing in…" submessage="Loading visit tracker." />
      )}
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-600 to-brand-900 px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-8 shadow-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Visit tracker</h1>
              <p className="text-sm text-slate-500">Staff sign in</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                required
                autoComplete="username"
                autoCapitalize="none"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="mt-1"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>
              {loading ? "Signing in…" : "Sign in"}
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
    </>
  );
}
