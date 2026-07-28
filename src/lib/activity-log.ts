import type { LoginEventType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ACTIVITY_LOG_RETENTION_DAYS = 30;

type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export function getClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || null;
}

export function parseDeviceLabel(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;

  let browser = "Browser";
  if (/Edg\//i.test(userAgent)) browser = "Edge";
  else if (/Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent)) browser = "Chrome";
  else if (/Firefox\//i.test(userAgent)) browser = "Firefox";
  else if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) browser = "Safari";

  let os = "Unknown OS";
  if (/Windows NT/i.test(userAgent)) os = "Windows";
  else if (/Mac OS X/i.test(userAgent)) os = "macOS";
  else if (/Android/i.test(userAgent)) os = "Android";
  else if (/iPhone|iPad/i.test(userAgent)) os = "iOS";
  else if (/Linux/i.test(userAgent)) os = "Linux";

  return `${browser} on ${os}`;
}

export async function purgeOldActivityLogs() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ACTIVITY_LOG_RETENTION_DAYS);

  await Promise.all([
    prisma.loginEvent.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.accessLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
  ]);
}

function metaFields(meta: RequestMeta) {
  const userAgent = meta.userAgent?.trim() || null;
  return {
    ipAddress: meta.ipAddress?.trim() || null,
    userAgent,
    deviceLabel: parseDeviceLabel(userAgent),
  };
}

async function resolveActivityActor(userId: string, clientId?: string | null) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) return null;

  let resolvedClientId = clientId ?? null;
  if (resolvedClientId) {
    const client = await prisma.client.findUnique({
      where: { id: resolvedClientId },
      select: { id: true },
    });
    if (!client) resolvedClientId = null;
  }

  return { userId: user.id, clientId: resolvedClientId };
}

export async function recordLoginSuccess(input: {
  userId: string;
  clientId?: string | null;
  role: UserRole;
  meta: RequestMeta;
}) {
  await purgeOldActivityLogs();
  await prisma.loginEvent.create({
    data: {
      userId: input.userId,
      clientId: input.clientId ?? null,
      role: input.role,
      eventType: "LOGIN_SUCCESS",
      ...metaFields(input.meta),
    },
  });
}

export async function recordLoginFailed(input: {
  identifier: string;
  meta: RequestMeta;
}) {
  await purgeOldActivityLogs();
  await prisma.loginEvent.create({
    data: {
      eventType: "LOGIN_FAILED",
      identifier: input.identifier,
      ...metaFields(input.meta),
    },
  });
}

export async function recordLogout(input: {
  userId: string;
  clientId?: string | null;
  role?: UserRole | null;
  meta?: RequestMeta;
}): Promise<boolean> {
  await purgeOldActivityLogs();
  const actor = await resolveActivityActor(input.userId, input.clientId);
  if (!actor) return false;

  await prisma.loginEvent.create({
    data: {
      userId: actor.userId,
      clientId: actor.clientId,
      role: input.role ?? null,
      eventType: "LOGOUT",
      ...metaFields(input.meta ?? {}),
    },
  });
  return true;
}

export async function recordAccessLog(input: {
  userId: string;
  clientId?: string | null;
  role: UserRole;
  path: string;
  meta: RequestMeta;
}): Promise<boolean> {
  await purgeOldActivityLogs();
  const actor = await resolveActivityActor(input.userId, input.clientId);
  if (!actor) return false;

  await prisma.accessLog.create({
    data: {
      userId: actor.userId,
      clientId: actor.clientId,
      role: input.role,
      path: input.path,
      ...metaFields(input.meta),
    },
  });
  return true;
}

export const LOGIN_EVENT_LABELS: Record<LoginEventType, string> = {
  LOGIN_SUCCESS: "Login",
  LOGIN_FAILED: "Failed login",
  LOGOUT: "Logout",
};

export type ActivityFeedItem =
  | {
      kind: "login";
      id: string;
      createdAt: Date;
      eventType: LoginEventType;
      userLabel: string;
      clientName: string | null;
      role: UserRole | null;
      identifier: string | null;
      ipAddress: string | null;
      deviceLabel: string | null;
    }
  | {
      kind: "access";
      id: string;
      createdAt: Date;
      userLabel: string;
      clientName: string | null;
      role: UserRole;
      path: string;
      ipAddress: string | null;
      deviceLabel: string | null;
    };

export async function listActivityFeed(input: {
  kind?: "all" | "login" | "access";
  clientId?: string;
  loginEventType?: LoginEventType;
  from?: Date;
  to?: Date;
  limit?: number;
}): Promise<ActivityFeedItem[]> {
  await purgeOldActivityLogs();

  const limit = input.limit ?? 300;
  const createdAt =
    input.from || input.to
      ? {
          ...(input.from ? { gte: input.from } : {}),
          ...(input.to ? { lte: input.to } : {}),
        }
      : undefined;

  const includeLogin = !input.kind || input.kind === "all" || input.kind === "login";
  const includeAccess = !input.kind || input.kind === "all" || input.kind === "access";

  const [loginEvents, accessLogs] = await Promise.all([
    includeLogin
      ? prisma.loginEvent.findMany({
          where: {
            ...(input.clientId ? { clientId: input.clientId } : {}),
            ...(input.loginEventType ? { eventType: input.loginEventType } : {}),
            ...(createdAt ? { createdAt } : {}),
          },
          include: {
            user: { select: { email: true, username: true, name: true } },
            client: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : [],
    includeAccess
      ? prisma.accessLog.findMany({
          where: {
            ...(input.clientId ? { clientId: input.clientId } : {}),
            ...(createdAt ? { createdAt } : {}),
          },
          include: {
            user: { select: { email: true, username: true, name: true } },
            client: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : [],
  ]);

  const feed: ActivityFeedItem[] = [
    ...loginEvents.map((event) => ({
      kind: "login" as const,
      id: event.id,
      createdAt: event.createdAt,
      eventType: event.eventType,
      userLabel:
        event.user?.name ??
        event.user?.email ??
        event.user?.username ??
        event.identifier ??
        "Unknown",
      clientName: event.client?.name ?? null,
      role: event.role,
      identifier: event.identifier,
      ipAddress: event.ipAddress,
      deviceLabel: event.deviceLabel,
    })),
    ...accessLogs.map((log) => ({
      kind: "access" as const,
      id: log.id,
      createdAt: log.createdAt,
      userLabel: log.user.name ?? log.user.email ?? log.user.username ?? "Unknown",
      clientName: log.client?.name ?? null,
      role: log.role,
      path: log.path,
      ipAddress: log.ipAddress,
      deviceLabel: log.deviceLabel,
    })),
  ];

  feed.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return feed.slice(0, limit);
}
