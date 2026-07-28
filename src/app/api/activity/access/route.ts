import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getClientIp, recordAccessLog } from "@/lib/activity-log";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let path = "";
  try {
    const body = (await request.json()) as { path?: string };
    path = String(body.path ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!path || path.includes("/login")) {
    return NextResponse.json({ ok: true });
  }

  const h = await headers();
  await recordAccessLog({
    userId: session.user.id,
    clientId: session.user.clientId ?? null,
    role: session.user.role,
    path,
    meta: {
      ipAddress: getClientIp(h),
      userAgent: h.get("user-agent"),
    },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
