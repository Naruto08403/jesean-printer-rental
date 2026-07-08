"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardTitle } from "@/components/ui/card";
import { LoadingOverlay } from "@/components/loading-overlay";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: fd.get("email"),
      password: fd.get("password"),
      redirect: false,
    });
    if (res?.error) {
      setLoading(false);
      setError("Invalid email or password");
      return;
    }
    router.refresh();
    router.push(params.get("callbackUrl") ?? "/");
  }

  return (
    <>
      {loading && (
        <LoadingOverlay
          message="Signing in…"
          submessage="Connecting to your admin dashboard."
        />
      )}
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-600 to-brand-900 px-4">
      <Card className="w-full max-w-md">
        <CardTitle>Staff sign in</CardTitle>
        <p className="mt-1 text-sm text-slate-500">Admin dashboard — email and password.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" loading={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Client?{" "}
          <Link href="/portal/login" className="text-brand-600 hover:underline">
            Portal sign in
          </Link>
        </p>
        <Link href="/" className="mt-2 block text-center text-sm text-brand-600 hover:underline">
          Back to home
        </Link>
      </Card>
    </div>
    </>
  );
}
