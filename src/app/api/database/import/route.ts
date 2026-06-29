import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { importDatabaseBackup, validateDatabaseBackup } from "@/lib/database-backup";

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const formData = await request.formData();
    const file = formData.get("file");
    const confirm = formData.get("confirm") === "true";

    if (!confirm) {
      return NextResponse.json(
        { error: "Confirm that you want to replace all database data." },
        { status: 400 }
      );
    }

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose a backup JSON file." }, { status: 400 });
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "Backup file is too large (max 50 MB)." }, { status: 400 });
    }

    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Backup file is not valid JSON." }, { status: 400 });
    }

    const backup = validateDatabaseBackup(parsed);
    const result = await importDatabaseBackup(backup);

    return NextResponse.json({
      ok: true,
      importedAt: new Date().toISOString(),
      exportedAt: backup.exportedAt,
      counts: result.counts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    const status =
      message === "Unauthorized" ? 401 : message.includes("backup") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
