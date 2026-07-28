import Link from "next/link";
import type { LoginEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import {
  listActivityFeed,
  LOGIN_EVENT_LABELS,
  ACTIVITY_LOG_RETENTION_DAYS,
} from "@/lib/activity-log";
import { formatDate } from "@/lib/utils";

const KIND_OPTIONS = [
  { value: "all", label: "All" },
  { value: "login", label: "Logins" },
  { value: "access", label: "Site access" },
] as const;

const LOGIN_TYPE_OPTIONS: { value: LoginEventType | "all"; label: string }[] = [
  { value: "all", label: "All login events" },
  { value: "LOGIN_SUCCESS", label: "Successful login" },
  { value: "LOGIN_FAILED", label: "Failed login" },
  { value: "LOGOUT", label: "Logout" },
];

function buildHref(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const q = search.toString();
  return q ? `/dashboard/activity?${q}` : "/dashboard/activity";
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string;
    client?: string;
    loginType?: string;
    from?: string;
    to?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const kind =
    params.kind === "login" || params.kind === "access" ? params.kind : "all";
  const clientId = params.client?.trim() || undefined;
  const loginEventType =
    params.loginType === "LOGIN_SUCCESS" ||
    params.loginType === "LOGIN_FAILED" ||
    params.loginType === "LOGOUT"
      ? params.loginType
      : undefined;

  const from = params.from ? new Date(params.from) : undefined;
  const to = params.to ? new Date(`${params.to}T23:59:59.999`) : undefined;

  const [clients, items] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    listActivityFeed({
      kind,
      clientId,
      loginEventType: kind === "access" ? undefined : loginEventType,
      from: from && !Number.isNaN(from.getTime()) ? from : undefined,
      to: to && !Number.isNaN(to.getTime()) ? to : undefined,
    }),
  ]);

  const baseParams = {
    kind: kind === "all" ? undefined : kind,
    client: clientId,
    loginType: loginEventType,
    from: params.from,
    to: params.to,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        subtitle={`Login and site access logs · auto-deleted after ${ACTIVITY_LOG_RETENTION_DAYS} days`}
      />

      <form
        method="get"
        action="/dashboard/activity"
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Type</label>
          <select
            name="kind"
            defaultValue={kind}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Client</label>
          <select
            name="client"
            defaultValue={clientId ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Login event</label>
          <select
            name="loginType"
            defaultValue={loginEventType ?? "all"}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            disabled={kind === "access"}
          >
            {LOGIN_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">From</label>
          <input
            type="date"
            name="from"
            defaultValue={params.from ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">To</label>
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex justify-end sm:col-span-2 lg:col-span-5">
          <button
            type="submit"
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            Apply filters
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {KIND_OPTIONS.map((option) => {
          const active = kind === option.value;
          return (
            <Link
              key={option.value}
              href={buildHref({
                ...baseParams,
                kind: option.value === "all" ? undefined : option.value,
              })}
              className={
                active
                  ? "rounded-full bg-brand-700 px-3 py-1 text-sm font-medium text-white"
                  : "rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 hover:border-brand-300 hover:text-brand-700"
              }
            >
              {option.label}
            </Link>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-slate-500">
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Detail</th>
              <th className="px-4 py-3 font-medium">Device</th>
              <th className="px-4 py-3 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No activity recorded yet.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr
                key={`${item.kind}-${item.id}`}
                className="border-b border-slate-50 hover:bg-slate-50/50"
              >
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {formatDate(item.createdAt)}
                </td>
                <td className="px-4 py-3">
                  {item.kind === "login" ? (
                    <span
                      className={
                        item.eventType === "LOGIN_FAILED"
                          ? "font-medium text-red-700"
                          : item.eventType === "LOGOUT"
                            ? "text-slate-600"
                            : "font-medium text-emerald-700"
                      }
                    >
                      {LOGIN_EVENT_LABELS[item.eventType]}
                    </span>
                  ) : (
                    <span className="font-medium text-brand-700">Page visit</span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{item.userLabel}</td>
                <td className="px-4 py-3 text-slate-600">{item.clientName ?? "—"}</td>
                <td className="max-w-[220px] truncate px-4 py-3 text-slate-600">
                  {item.kind === "access"
                    ? item.path
                    : item.kind === "login" &&
                        item.identifier &&
                        item.eventType === "LOGIN_FAILED"
                      ? `Attempt: ${item.identifier}`
                      : item.role ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{item.deviceLabel ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{item.ipAddress ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
