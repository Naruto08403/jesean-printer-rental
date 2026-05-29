import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  const isAuthPage = pathname === "/login";
  const isAdminRoute = pathname.startsWith("/dashboard");
  const isPortalRoute = pathname.startsWith("/portal");

  if (isAuthPage && isLoggedIn) {
    const dest = role === "ADMIN" ? "/dashboard" : "/portal";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  if ((isAdminRoute || isPortalRoute) && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isAdminRoute && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/portal", req.url));
  }

  if (isPortalRoute && role !== "CLIENT") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/portal/:path*", "/login"],
};
