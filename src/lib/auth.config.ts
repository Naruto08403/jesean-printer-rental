import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;
      const role = auth?.user?.role;

      const isStaffLogin = pathname === "/login";
      const isPortalLogin = pathname === "/portal/login";
      const isAdminRoute = pathname.startsWith("/dashboard");
      const isPortalApp =
        pathname.startsWith("/portal") && pathname !== "/portal/login";

      if (isStaffLogin && isLoggedIn) {
        return Response.redirect(
          new URL(role === "ADMIN" ? "/dashboard" : "/portal", nextUrl)
        );
      }

      if (isPortalLogin && isLoggedIn && role === "CLIENT") {
        return Response.redirect(new URL("/portal", nextUrl));
      }

      if (isPortalApp && !isLoggedIn) {
        return Response.redirect(new URL("/portal/login", nextUrl));
      }

      if (isAdminRoute && !isLoggedIn) {
        return false;
      }

      if (isAdminRoute && role !== "ADMIN") {
        return Response.redirect(new URL("/portal", nextUrl));
      }

      if (isPortalApp && role !== "CLIENT") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      if (isPortalLogin && isLoggedIn && role === "ADMIN") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.clientId = user.clientId;
        token.username = user.username;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as typeof session.user.role;
        session.user.clientId = (token.clientId as string | null) ?? null;
        session.user.username = (token.username as string | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
