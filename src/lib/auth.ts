import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: UserRole;
    clientId?: string | null;
    username?: string | null;
  }
  interface Session {
    user: {
      id: string;
      email?: string | null;
      username?: string | null;
      name?: string | null;
      role: UserRole;
      clientId?: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: UserRole;
    clientId?: string | null;
    username?: string | null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const password = credentials?.password as string | undefined;
        const email = (credentials?.email as string | undefined)?.toLowerCase().trim();
        const username = (credentials?.username as string | undefined)?.toLowerCase().trim();

        if (!password || (!email && !username)) return null;

        const user = email
          ? await prisma.user.findUnique({
              where: { email },
              include: { client: { select: { id: true } } },
            })
          : await prisma.user.findFirst({
              where: { username: username! },
              include: { client: { select: { id: true } } },
            });

        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        if (username && user.role !== "CLIENT") return null;
        if (email && user.role !== "ADMIN") return null;

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          role: user.role,
          clientId: user.client?.id ?? null,
        };
      },
    }),
  ],
});

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireClient() {
  const session = await auth();
  if (!session?.user || session.user.role !== "CLIENT" || !session.user.clientId) {
    throw new Error("Unauthorized");
  }
  return session;
}
