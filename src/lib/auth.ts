import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import {
  getClientIp,
  recordLoginFailed,
  recordLoginSuccess,
  recordLogout,
} from "@/lib/activity-log";
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

async function requestMeta() {
  const h = await headers();
  return {
    ipAddress: getClientIp(h),
    userAgent: h.get("user-agent"),
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  events: {
    async signOut(message) {
      const token = "token" in message ? message.token : undefined;
      const userId = token?.sub;
      if (!userId) return;

      const meta = await requestMeta();
      await recordLogout({
        userId,
        clientId: (token?.clientId as string | null | undefined) ?? null,
        role: (token?.role as UserRole | undefined) ?? null,
        meta,
      });
    },
  },
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
        const identifier = email || username || "unknown";
        const meta = await requestMeta();

        if (!password || (!email && !username)) {
          await recordLoginFailed({ identifier, meta });
          return null;
        }

        const user = email
          ? await prisma.user.findUnique({
              where: { email },
              include: { client: { select: { id: true } } },
            })
          : await prisma.user.findFirst({
              where: { username: username! },
              include: { client: { select: { id: true } } },
            });

        if (!user) {
          await recordLoginFailed({ identifier, meta });
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          await recordLoginFailed({ identifier, meta });
          return null;
        }

        if (username && user.role !== "CLIENT") {
          await recordLoginFailed({ identifier, meta });
          return null;
        }
        if (email && user.role !== "ADMIN") {
          await recordLoginFailed({ identifier, meta });
          return null;
        }

        await recordLoginSuccess({
          userId: user.id,
          clientId: user.client?.id ?? null,
          role: user.role,
          meta,
        });

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
