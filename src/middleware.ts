import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

function shouldLogAccess(pathname: string) {
  if (pathname.includes("/login")) return false;
  if (pathname.startsWith("/api/")) return false;
  return pathname.startsWith("/dashboard") || pathname.startsWith("/portal");
}

function getSessionUserId(session: { user?: { id?: string | null } } | null) {
  const id = session?.user?.id?.trim();
  return id || null;
}

export default auth((req) => {
  const session = req.auth;
  const pathname = req.nextUrl.pathname;
  const userId = getSessionUserId(session);

  if (userId && shouldLogAccess(pathname)) {
    const origin = req.nextUrl.origin;
    void fetch(`${origin}/api/activity/access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: req.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => undefined);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/portal/:path*", "/login"],
};
