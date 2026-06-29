import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  backupDownloadFilename,
  exportDatabaseBackup,
} from "@/lib/database-backup";

export async function GET() {
  try {
    await requireAdmin();

    const backup = await exportDatabaseBackup();
    const json = JSON.stringify(backup, null, 2);
    const filename = backupDownloadFilename(new Date(backup.exportedAt));

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
